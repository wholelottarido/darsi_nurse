import { generateText } from "ai";

import { resolveClinicalIcdCodes, searchClinicalIcdReferences } from "@/lib/icd-search";
import { getChatModel } from "@/lib/llm";
import { buildMedicationRecommendation } from "@/lib/medication-recommendations";
import { hospitalQuery } from "@/lib/hospital-db";
import { getCurrentPerawat } from "@/lib/nurse-auth";
import { createClinicalNote, type ClinicalNote } from "@/lib/clinical-notes";
import { resolveVisitContext } from "@/lib/visit-context";

type UpdateKind = "subjective" | "objective";

type ExternalDiagnosis = {
  icd_code?: string | null;
  icd_name?: string | null;
};

type PatientRow = {
  id: number;
  no_rm?: string | null;
  full_name?: string | null;
  date_of_birth?: string | null;
  jenis_kelamin?: string | null;
  phone?: string | null;
  email?: string | null;
  alergi?: string | null;
  riwayat_penyakit?: string | null;
  medical_record?: unknown;
};

type ExternalExamination = {
  id: number;
  registration_id?: number | null;
  doctor_id?: number | null;
  doctor_username?: string | null;
  status?: string | null;
  soap_subjective?: string | null;
  soap_objective?: string | null;
  soap_assessment?: string | null;
  soap_plan?: string | null;
  diagnoses?: ExternalDiagnosis[] | null;
  examination_notes?: string | null;
  created_at?: string | null;
};

type GeneratedSections = {
  patientCondition: string;
  summary: string;
  assessment: string;
  plan: string;
  medication: string;
  triageLevel: string | null;
  icd: Array<{ icd_code: string; icd_name: string; triageLevel?: string | null }>;
};

export type ChatClinicalUpdateResult = {
  patient: {
    id: number;
    no_rm: string;
    full_name: string;
  };
  note: ClinicalNote;
  updateKind: UpdateKind;
  updateText: string;
  icd: Array<{ icd_code: string; icd_name: string; triageLevel?: string | null }>;
};

function normalizeText(value?: string | null) {
  return (value || "").trim();
}

function parseMedicalRecord(value: unknown) {
  if (!value) {
    return {} as Record<string, unknown>;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {} as Record<string, unknown>;
    }
  }

  return {} as Record<string, unknown>;
}

function buildPatientContext(patient: PatientRow) {
  const medicalRecord = parseMedicalRecord(patient.medical_record);

  return {
    ...patient,
    jenis_kelamin:
      patient.jenis_kelamin ||
      (medicalRecord.jenis_kelamin as string | undefined) ||
      (medicalRecord.gender as string | undefined) ||
      "-",
    alergi:
      patient.alergi ||
      (medicalRecord.alergi as string | undefined) ||
      (medicalRecord.allergies as string | undefined) ||
      "-",
    riwayat_penyakit:
      patient.riwayat_penyakit ||
      (medicalRecord.riwayat_penyakit as string | undefined) ||
      (medicalRecord.riwayatPenyakit as string | undefined) ||
      "-",
  };
}

function extractSection(text: string, labels: string[]) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`${escaped}\\s*:\\s*([\\s\\S]*?)(?=\\n[A-Z][A-Z_ ]+\\s*:\\s*|$)`, "i");
    const match = text.match(regex);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return "";
}

function normalizeExamDiagnoses(diagnoses?: ExternalDiagnosis[] | null) {
  return (diagnoses || [])
    .map((item) => ({
      icd_code: String(item.icd_code || "-").trim().toUpperCase(),
      icd_name: String(item.icd_name || "-").trim(),
      triageLevel: null as string | null,
    }))
    .filter((item) => item.icd_code && item.icd_code !== "-");
}

function mergeIcdReferences(
  primary: Array<{ icd_code: string; icd_name: string; triageLevel?: string | null }>,
  secondary: Array<{ icd_code: string; icd_name: string; triageLevel?: string | null }>
) {
  const merged = new Map<string, { icd_code: string; icd_name: string; triageLevel?: string | null }>();

  [...primary, ...secondary].forEach((item) => {
    const code = String(item.icd_code || "").trim().toUpperCase();
    if (!code) return;

    const existing = merged.get(code);
    merged.set(code, {
      icd_code: code,
      icd_name: item.icd_name || existing?.icd_name || "-",
      triageLevel: item.triageLevel || existing?.triageLevel || null,
    });
  });

  return [...merged.values()];
}

async function findNurseContext() {
  const perawat = await getCurrentPerawat();
  if (!perawat) {
    throw new Error("Unauthorized");
  }

  const nurseResult = await hospitalQuery(
    `SELECT id
     FROM indirect_staff_nurses
     WHERE LOWER(username) = LOWER($1)
     LIMIT 1`,
    [perawat.username]
  );

  if (nurseResult.rows.length === 0) {
    throw new Error("Nurse not found");
  }

  return {
    perawat,
    nurseId: nurseResult.rows[0].id as number,
  };
}

function parseIcdSection(
  text: string,
  candidates: Array<{ icd_code: string; icd_name: string; triageLevel?: string | null }>
) {
  const extracted = extractSection(text, ["ICD", "DIAGNOSA ICD", "ICD_FINAL", "ICD TERBARU"]);
  if (!extracted) return [] as Array<{ icd_code: string; icd_name: string; triageLevel?: string | null }>;

  const results: Array<{ icd_code: string; icd_name: string; triageLevel?: string | null }> = [];
  const seen = new Set<string>();
  const allowedCodes = new Set(candidates.map((item) => item.icd_code.toUpperCase()));

  extracted
    .split(/\n|;/)
    .map((item) => item.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean)
    .forEach((item) => {
      const match = item.match(/([A-Z][0-9]{2}(?:\.[0-9A-Z]+)?\+?)\s*(?:[-–:]\s*(.+))?/i);
      if (!match) return;

      const code = match[1].toUpperCase();
      if (allowedCodes.size > 0 && !allowedCodes.has(code)) return;
      if (seen.has(code)) return;
      seen.add(code);

      const candidate = candidates.find((entry) => entry.icd_code.toUpperCase() === code);
      const rawName = match[2]?.trim() || "";
      const sanitizedRawName = rawName
        .replace(/\(.*?\)/g, "")
        .replace(/(?:koreksi|catatan)\s*:.*/i, "")
        .split(/[.](?=\s+[A-Z]|$)/)[0]
        .trim();
      const name = candidate?.icd_name || sanitizedRawName || "-";

      results.push({
        icd_code: code,
        icd_name: name,
        triageLevel: candidate?.triageLevel || null,
      });
    });

  return results;
}

async function resolveSelectedIcd(args: {
  generatedIcd: Array<{ icd_code: string; icd_name: string; triageLevel?: string | null }>;
  baseIcd: Array<{ icd_code: string; icd_name: string; triageLevel?: string | null }>;
  candidateIcd: Array<{ icd_code: string; icd_name: string; triageLevel?: string | null }>;
}) {
  const allowed = mergeIcdReferences(args.baseIcd, args.candidateIcd);
  const allowedCodes = new Set(allowed.map((item) => item.icd_code.toUpperCase()));
  const validatedGenerated = await resolveClinicalIcdCodes(args.generatedIcd.map((item) => item.icd_code));
  const validatedGeneratedMerged = mergeIcdReferences(validatedGenerated, args.generatedIcd);
  const filteredGenerated = allowedCodes.size > 0
    ? validatedGeneratedMerged.filter((item) => allowedCodes.has(item.icd_code.toUpperCase()))
    : validatedGeneratedMerged;
  const basePrimary = args.baseIcd[0] ?? null;
  const updatePrimary =
    filteredGenerated.find((item) => item.icd_code.toUpperCase() !== basePrimary?.icd_code?.toUpperCase()) ||
    args.candidateIcd.find((item) => item.icd_code.toUpperCase() !== basePrimary?.icd_code?.toUpperCase()) ||
    null;

  if (basePrimary && updatePrimary) {
    return [basePrimary, updatePrimary];
  }

  if (basePrimary) {
    return [basePrimary];
  }

  if (updatePrimary) {
    return [updatePrimary];
  }

  if (filteredGenerated.length > 0) {
    return filteredGenerated.slice(0, 2);
  }

  return allowed.slice(0, 2);
}

function buildPrompt(
  patient: PatientRow,
  exam: ExternalExamination | null,
  updateKind: UpdateKind,
  updateText: string,
  icdReferences: Array<{ icd_code: string; icd_name: string; triageLevel?: string | null }>
) {
  const baseSubjective = normalizeText(exam?.soap_subjective) || "-";
  const baseObjective = normalizeText(exam?.soap_objective) || "-";
  const baseAssessment = normalizeText(exam?.soap_assessment) || "-";
  const basePlan = normalizeText(exam?.soap_plan) || "-";
  const existingIcd = Array.isArray(exam?.diagnoses) && exam!.diagnoses!.length > 0
    ? exam!.diagnoses!.map((item) => `${item.icd_code || "-"} - ${item.icd_name || "-"}`).join("; ")
    : "-";
  const candidateIcd = icdReferences.length > 0
    ? icdReferences.map((item) => `${item.icd_code} - ${item.icd_name}${item.triageLevel ? ` (${item.triageLevel})` : ""}`).join("; ")
    : "-";

  const subjectiveForReasoning = updateKind === "subjective" ? updateText : baseSubjective;
  const objectiveForReasoning = updateKind === "objective" ? updateText : baseObjective;

  return [
    "Anda adalah perawat triase yang membuat clinical note terbaru tanpa mengubah SOAP awal dokter di external_examinations.",
    "",
    "ATURAN UTAMA:",
    "- Jangan mengubah atau menulis balik tabel external_examinations.",
    "- Update dari chat perawat dianggap sebagai kondisi terbaru pasien dan harus masuk ke clinical_notes.",
    "- KONDISI_PASIEN harus berisi status/kondisi pasien terbaru dari hasil chat, misalnya 'demam menurun, nyeri kaki menurun'.",
    "- SUMMARY harus merangkum kondisi terbaru pasien.",
    "- ASSESSMENT harus dibuat ulang berdasarkan SOAP awal dokter + update terbaru dari chat.",
    "- PLAN harus dibuat ulang sesuai kondisi terbaru pasien.",
    "- MEDICATION berisi rekomendasi obat singkat yang aman atau '-' bila belum cukup data.",
    "- TRIAGE_LEVEL harus salah satu dari URGENT, HIGH, MODERATE, LOW, UNKNOWN.",
    "- Gunakan kandidat ICD sebagai referensi, pilih yang paling relevan dengan kondisi terbaru.",
    "- ICD harus memilih kode diagnosis terbaru yang paling relevan dengan kondisi pasien saat ini, dan boleh berubah dibanding SOAP awal bila kondisi klinis berubah.",
    "- ICD HANYA BOLEH dipilih dari ICD AWAL dokter atau Kandidat ICD yang disediakan. Jangan membuat kode ICD baru di luar daftar tersebut.",
    "- Tampilkan maksimal 2 ICD: ICD pertama dari SOAP awal dokter sebagai baseline, ICD kedua dari update kondisi pasien bila ada diagnosis tambahan atau gejala baru yang relevan.",
    "- Jangan ganti nama diagnosis dengan narasi penjelasan; cukup tulis KODE - NAMA DIAGNOSIS sesuai referensi.",
    "- Jangan menyalin mentah seluruh data, buat ringkasan klinis yang padat.",
    "",
    "DATA PASIEN:",
    `Nama: ${patient.full_name || "Pasien"}`,
    `NRM: ${patient.no_rm || "-"}`,
    `Jenis Kelamin: ${patient.jenis_kelamin || "-"}`,
    `No HP: ${patient.phone || "-"}`,
    `Email: ${patient.email || "-"}`,
    `Alergi: ${patient.alergi || "-"}`,
    `Riwayat Penyakit: ${patient.riwayat_penyakit || "-"}`,
    "",
    "SOAP AWAL DOKTER (read-only, dari external_examinations):",
    `SUBJECTIVE AWAL:\n${baseSubjective}`,
    `OBJECTIVE AWAL:\n${baseObjective}`,
    `ASSESSMENT AWAL:\n${baseAssessment}`,
    `PLAN AWAL:\n${basePlan}`,
    `ICD AWAL:\n${existingIcd}`,
    "",
    "UPDATE TERBARU DARI CHAT PERAWAT:",
    `Jenis update: ${updateKind.toUpperCase()}`,
    `${updateKind.toUpperCase()} TERBARU:\n${updateText}`,
    "",
    "KONDISI KERJA TERKINI UNTUK PENILAIAN:",
    `Subjective terbaru untuk dianalisis:\n${subjectiveForReasoning}`,
    `Objective terbaru untuk dianalisis:\n${objectiveForReasoning}`,
    "",
    `Kandidat ICD hasil pencarian gejala:\n${candidateIcd}`,
    "",
    "Output wajib persis format berikut:",
    "KONDISI_PASIEN:",
    "...",
    "SUMMARY:",
    "...",
    "ASSESSMENT:",
    "...",
    "PLAN:",
    "...",
    "MEDICATION:",
    "...",
    "ICD:",
    "KODE - NAMA DIAGNOSIS",
    "TRIAGE_LEVEL:",
    "URGENT/HIGH/MODERATE/LOW/UNKNOWN",
  ].join("\n");
}

async function generateSections(
  prompt: string,
  icdCandidates: Array<{ icd_code: string; icd_name: string; triageLevel?: string | null }>
): Promise<GeneratedSections> {
  const result = await generateText({
    model: getChatModel(),
    prompt,
    temperature: 0.2,
    maxOutputTokens: 1000,
  });

  const text = result.text.replace(/\r/g, "").trim();
  const patientCondition = extractSection(text, ["KONDISI_PASIEN", "KONDISI PASIEN", "PATIENT_CONDITION"]) || "-";
  const summary = extractSection(text, ["SUMMARY", "RINGKASAN"]) || text;
  const assessment = extractSection(text, ["ASSESSMENT", "PENILAIAN"]) || "-";
  const plan = extractSection(text, ["PLAN", "RENCANA"]) || "-";
  const medication = extractSection(text, ["MEDICATION", "OBAT", "REKOMENDASI OBAT"]) || "-";
  const icd = parseIcdSection(text, icdCandidates);
  const triageLevelRaw = extractSection(text, ["TRIAGE_LEVEL", "TRIAGE"]) || "UNKNOWN";
  const triageLevel = ["URGENT", "HIGH", "MODERATE", "LOW", "UNKNOWN"].includes(triageLevelRaw.toUpperCase())
    ? triageLevelRaw.toUpperCase()
    : "UNKNOWN";

  return {
    patientCondition: patientCondition || "-",
    summary: summary || "-",
    assessment: assessment || "-",
    plan: plan || "-",
    medication: medication || "-",
    triageLevel,
    icd,
  };
}

export async function createClinicalNoteFromChatUpdate(args: {
  patientId: number;
  triageVisitId?: number | null;
  updateKind: UpdateKind;
  updateText: string;
}): Promise<ChatClinicalUpdateResult | null> {
  const updateText = normalizeText(args.updateText);
  if (!updateText) {
    throw new Error(`Update ${args.updateKind} tidak boleh kosong`);
  }

  const [{ nurseId }, patientResult] = await Promise.all([
    findNurseContext(),
    hospitalQuery(
      `SELECT id, no_rm, full_name, date_of_birth, phone, email, medical_record
       FROM patients
       WHERE id = $1
       LIMIT 1`,
      [args.patientId]
    ),
  ]);

  if (patientResult.rows.length === 0) {
    return null;
  }

  const patient = buildPatientContext(patientResult.rows[0] as PatientRow);

  const visitContext = await resolveVisitContext(args.patientId, args.triageVisitId ?? null);
  const registrationId = visitContext.registrationId ?? null;

  const [examResult, icdReferences] = await Promise.all([
    registrationId
      ? hospitalQuery(
          `SELECT id, registration_id, doctor_id, doctor_username, status, soap_subjective, soap_objective, soap_assessment, soap_plan, diagnoses, examination_notes, created_at
           FROM external_examinations
           WHERE registration_id = $1
           ORDER BY created_at DESC, id DESC
           LIMIT 1`,
          [registrationId]
        )
      : hospitalQuery(
          `SELECT id, registration_id, doctor_id, doctor_username, status, soap_subjective, soap_objective, soap_assessment, soap_plan, diagnoses, examination_notes, created_at
           FROM external_examinations
           WHERE patient_id = $1
           ORDER BY created_at DESC, id DESC
           LIMIT 1`,
          [args.patientId]
        ),
    searchClinicalIcdReferences(updateText, 5),
  ]);

  const exam = (examResult.rows[0] as ExternalExamination | undefined) ?? null;
  const baseIcd = normalizeExamDiagnoses(exam?.diagnoses);
  const allowedIcdReferences = mergeIcdReferences(baseIcd, icdReferences);

  const prompt = buildPrompt(patient, exam, args.updateKind, updateText, allowedIcdReferences);
  const generated = await generateSections(prompt, allowedIcdReferences);
  const generatedSearchText = [
    generated.patientCondition,
    generated.summary,
    generated.assessment,
    generated.plan,
    updateText,
  ].filter(Boolean).join(' ');
  const secondaryIcdReferences = allowedIcdReferences.length === 0
    ? await searchClinicalIcdReferences(generatedSearchText, 5)
    : [];
  const resolvedIcdReferences = mergeIcdReferences(allowedIcdReferences, secondaryIcdReferences);
  const selectedIcd = await resolveSelectedIcd({
    generatedIcd: generated.icd,
    baseIcd,
    candidateIcd: resolvedIcdReferences,
  });
  const finalIcd = selectedIcd.length > 0 ? selectedIcd : resolvedIcdReferences.slice(0, 2);
  const finalMedication = generated.medication && generated.medication.trim() !== '-'
    ? generated.medication
    : buildMedicationRecommendation({
        icd: finalIcd,
        patientCondition: generated.patientCondition,
        summary: generated.summary,
        assessment: generated.assessment,
        plan: generated.plan,
      });

  const note = await createClinicalNote({
    patientId: args.patientId,
    doctorId: exam?.doctor_id ?? null,
    triageVisitId: visitContext.triageVisitId ?? null,
    source: "chat",
    status: "draft",
    patientCondition: generated.patientCondition,
    summary: generated.summary,
    assessment: generated.assessment,
    plan: generated.plan,
    medicationRecommendation: finalMedication,
    triageLevel: generated.triageLevel,
    evidenceRefs: {
      nurse_id: nurseId,
      registration_id: registrationId,
      triage_visit_id: visitContext.triageVisitId ?? null,
      external_examination_id: exam?.id ?? null,
      base_external_examination: exam
        ? {
            id: exam.id,
            soap_subjective: exam.soap_subjective ?? null,
            soap_objective: exam.soap_objective ?? null,
            soap_assessment: exam.soap_assessment ?? null,
            soap_plan: exam.soap_plan ?? null,
          }
        : null,
      chat_update_type: args.updateKind,
      chat_update_text: updateText,
      icd: finalIcd,
    },
  });

  return {
    patient: {
      id: patient.id,
      no_rm: patient.no_rm || "-",
      full_name: patient.full_name || "Pasien",
    },
    note,
    updateKind: args.updateKind,
    updateText,
    icd: finalIcd,
  };
}
