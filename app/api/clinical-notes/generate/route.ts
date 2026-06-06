import { NextResponse } from "next/server";

import { generateClinicalNotesFromSoap } from "@/lib/agent";
import { createClinicalNote, getLatestClinicalNote } from "@/lib/clinical-notes";
import { hospitalQuery } from "@/lib/hospital-db";
import { getCurrentPerawat } from "@/lib/nurse-auth";
import { regenerateSoapAssessmentPlan } from "@/lib/soap-followup";

type ExternalDiagnosis = {
  icd_code?: string | null;
  icd_name?: string | null;
};

type ExternalExamination = {
  id: number;
  patient_id: number;
  doctor_id?: number | null;
  doctor_username?: string | null;
  status?: string | null;
  soap_subjective?: string | null;
  soap_objective?: string | null;
  soap_assessment?: string | null;
  soap_plan?: string | null;
  diagnoses?: ExternalDiagnosis[] | null;
  disposition?: string | null;
  examination_notes?: string | null;
  created_at?: string | null;
};

type ExamSnapshot = {
  status?: string | null;
  soap_subjective?: string | null;
  soap_objective?: string | null;
  soap_assessment?: string | null;
  soap_plan?: string | null;
  examination_notes?: string | null;
  diagnoses?: Array<{ icd_code?: string; icd_name?: string }>;
};

type PatientRow = {
  id: number;
  no_rm?: string | null;
  full_name?: string | null;
  date_of_birth?: string | null;
  phone?: string | null;
  email?: string | null;
  medical_record?: string | null;
};

function formatValue(value?: string | number | null) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return String(value);
}

function buildPrompt(patient: PatientRow, exam: ExternalExamination) {
  const patientName = patient.full_name || "Pasien";
  const patientMrn = patient.no_rm || "-";
  const subjective = exam.soap_subjective || "-";
  const objective = exam.soap_objective || "-";
  const assessment = exam.soap_assessment || "-";
  const plan = exam.soap_plan || "-";
  const examinationNotes = exam.examination_notes || "-";

  const diagnosesText = exam.diagnoses && exam.diagnoses.length > 0
    ? exam.diagnoses.map((item) => `${item.icd_code || "-"} - ${item.icd_name || "-"}`).join("; ")
    : "-";
  const primaryComplaint = inferPrimaryComplaint(subjective, objective, diagnosesText);
  const complaintAnchors = buildComplaintAnchors(primaryComplaint);

  return `Anda adalah perawat triase. Buat clinical summary yang merangkum kondisi pasien berdasarkan data SOAP dari tabel external_examinations.\n\n` +
    `DATA PASIEN:\n` +
    `Nama: ${patientName}\n` +
    `NRM: ${patientMrn}\n` +
    `No HP: ${formatValue(patient.phone)}\n` +
    `Email: ${formatValue(patient.email)}\n\n` +
    `SUMBER UTAMA (external_examinations):\n` +
    `SOAP SUBJECTIVE:\n${subjective}\n\n` +
    `SOAP OBJECTIVE:\n${objective}\n\n` +
    `KELUHAN UTAMA TERDETEKSI:\n${primaryComplaint || "-"}\n\n` +
    `${complaintAnchors}\n\n` +
    `SOAP ASSESSMENT:\n${assessment}\n\n` +
    `SOAP PLAN:\n${plan}\n\n` +
    `EXAMINATION NOTES:\n${examinationNotes}\n\n` +
    `DIAGNOSA ICD:\n${diagnosesText}\n\n` +
    `Aturan:\n` +
    `- SUMMARY harus benar-benar merangkum kondisi pasien saat ini, bukan menyalin SOAP mentah.\n` +
    `- SUMMARY fokus pada keluhan utama, temuan penting, dan kesimpulan klinis singkat.\n` +
    `- ASSESSMENT harus menjelaskan interpretasi klinis dari subjective, objective, dan diagnosis ICD.\n` +
    `- Jika keluhan utama terdeteksi, pertahankan konsistensi anatomi. Jangan mengubah sakit perut menjadi sakit kepala atau sebaliknya.\n` +
    `- PLAN harus berisi rencana tindakan yang relevan dengan kondisi pasien.\n` +
    `- MEDICATION hanya bila dapat disimpulkan dari data; jika tidak, isi '-'.\n` +
    `- TRIAGE_LEVEL harus salah satu dari URGENT, HIGH, MODERATE, LOW, atau UNKNOWN.\n` +
    `- Gunakan Bahasa Indonesia yang ringkas, klinis, dan jelas.\n` +
    `- Jangan mencantumkan patient ID.\n` +
    `- Jangan mengarang data baru; gunakan '-' jika tidak ada informasi.\n\n` +
    `- Jika ada data yang saling mendukung, gabungkan menjadi satu ringkasan kondisi pasien.\n` +
    `- Hindari kalimat generik seperti "pasien dalam kondisi baik" kecuali memang didukung oleh temuan.\n\n` +
    `Output HARUS dengan format berikut (persis labelnya):\n` +
    `SUMMARY:\nringkasan kondisi pasien\n` +
    `ASSESSMENT:\ninterpretasi klinis\n` +
    `PLAN:\nrencana tindakan\n` +
    `MEDICATION:\nrekomendasi obat atau '-'\n` +
    `TRIAGE_LEVEL:\nURGENT/HIGH/MODERATE/LOW/UNKNOWN\n`;
}

function extractSection(text: string, labels: string[]) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`${escaped}\\s*:\\s*([\\s\\S]*?)(?=\\n[A-Z][A-Z_ ]+\\s*:\\s*|$)`, "i");
    const match = text.match(regex);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return "";
}

function normalizeDiagnoses(diagnoses?: ExternalDiagnosis[] | null) {
  return (diagnoses || []).map((item) => ({
    icd_code: item.icd_code || "-",
    icd_name: item.icd_name || "-",
  }));
}

function normalizeText(value?: string | null) {
  return (value || '').toLowerCase();
}

function inferPrimaryComplaint(subjective: string, objective: string, diagnosesText: string) {
  const combined = `${subjective} ${objective} ${diagnosesText}`.toLowerCase();

  const complaintRules = [
    { label: 'sakit perut', hints: ['sakit perut', 'nyeri perut', 'perut sakit', 'abdomen nyeri', 'nyeri abdomen', 'abdominal pain', 'maag', 'mules'] },
    { label: 'sakit kepala', hints: ['sakit kepala', 'nyeri kepala', 'pusing', 'cephalgia', 'headache'] },
    { label: 'diare', hints: ['diare', 'mencret', 'buang air besar cair', 'diarrhea'] },
    { label: 'mual muntah', hints: ['mual', 'muntah', 'nausea', 'vomit', 'vomiting'] },
    { label: 'batuk', hints: ['batuk', 'cough'] },
    { label: 'demam', hints: ['demam', 'fever', 'panas'] },
    { label: 'sesak napas', hints: ['sesak', 'sesak napas', 'dyspnea', 'shortness of breath'] },
    { label: 'nyeri dada', hints: ['nyeri dada', 'sakit dada', 'chest pain'] },
  ];

  for (const rule of complaintRules) {
    if (rule.hints.some((hint) => combined.includes(hint))) {
      return rule.label;
    }
  }

  return null;
}

function hasContradictoryComplaint(text: string, primaryComplaint: string | null) {
  if (!primaryComplaint) return false;

  const normalized = normalizeText(text);
  if (primaryComplaint === 'sakit perut') {
    return normalized.includes('sakit kepala') || normalized.includes('headache') || normalized.includes('nyeri kepala');
  }

  if (primaryComplaint === 'sakit kepala') {
    return normalized.includes('sakit perut') || normalized.includes('nyeri perut') || normalized.includes('abdominal');
  }

  return false;
}

function buildComplaintAnchors(primaryComplaint: string | null) {
  if (!primaryComplaint) {
    return 'Keluhan utama tidak terdeteksi jelas dari data yang tersedia.';
  }

  return `Keluhan utama yang harus dipertahankan: ${primaryComplaint}. Jangan ubah fokus anatomi menjadi keluhan lain yang berbeda.`;
}

function buildExamSnapshot(exam: ExternalExamination): ExamSnapshot {
  return {
    status: exam.status ?? null,
    soap_subjective: exam.soap_subjective ?? null,
    soap_objective: exam.soap_objective ?? null,
    soap_assessment: exam.soap_assessment ?? null,
    soap_plan: exam.soap_plan ?? null,
    examination_notes: exam.examination_notes ?? null,
    diagnoses: normalizeDiagnoses(exam.diagnoses),
  };
}

function snapshotsMatch(a?: ExamSnapshot | null, b?: ExamSnapshot | null) {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function hasMeaningfulValue(value?: string | null) {
  const normalized = value?.trim();
  return Boolean(normalized && normalized !== "-");
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const patientId = Number(body.patientId);

    if (!Number.isFinite(patientId)) {
      return NextResponse.json({ error: "patientId must be a number" }, { status: 400 });
    }

    const perawat = await getCurrentPerawat();
    if (!perawat) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const nurseResult = await hospitalQuery(
      `SELECT id
       FROM indirect_staff_nurses
       WHERE LOWER(username) = LOWER($1)
       LIMIT 1`,
      [perawat.username]
    );

    if (nurseResult.rows.length === 0) {
      return NextResponse.json({ error: "Nurse not found" }, { status: 404 });
    }

    const nurseId = nurseResult.rows[0].id as number;

    const patientResult = await hospitalQuery(
      `SELECT id, no_rm, full_name, date_of_birth, phone, email, medical_record
       FROM patients
       WHERE id = $1`,
      [patientId]
    );

    if (patientResult.rows.length === 0) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const registrationResult = await hospitalQuery(
      `SELECT r.id
       FROM registrations r
       WHERE r.patient_id = $1 AND r.nurse_id = $2
       ORDER BY COALESCE(r.updated_at, r.created_at) DESC
       LIMIT 1`,
      [patientId, nurseId]
    );

    if (registrationResult.rows.length === 0) {
      return NextResponse.json({ note: null, reason: "no_registration" });
    }

    const registrationId = registrationResult.rows[0].id as number;
    const examResult = await hospitalQuery(
      `SELECT
        id,
        patient_id,
        registration_id,
        doctor_id,
        doctor_username,
        status,
        soap_subjective,
        soap_objective,
        soap_assessment,
        soap_plan,
        diagnoses,
        disposition,
        examination_notes,
        created_at
       FROM external_examinations
       WHERE registration_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [registrationId]
    );

    if (examResult.rows.length === 0) {
      return NextResponse.json({ note: null, reason: "no_soap" });
    }

    let exam = examResult.rows[0] as ExternalExamination;

    if (
      hasMeaningfulValue(exam.soap_subjective) &&
      hasMeaningfulValue(exam.soap_objective) &&
      (!hasMeaningfulValue(exam.soap_assessment) || !hasMeaningfulValue(exam.soap_plan))
    ) {
      const followUp = await regenerateSoapAssessmentPlan(patientId, exam.id);
      if (followUp.success && followUp.updatedExam) {
        exam = {
          ...exam,
          ...followUp.updatedExam,
        };
      }
    }

    const currentSnapshot = buildExamSnapshot(exam);
    const latestNote = await getLatestClinicalNote(patientId, nurseId, registrationId);
    const noteEvidenceRefs = latestNote?.evidence_refs && typeof latestNote.evidence_refs === "object"
      ? (latestNote.evidence_refs as {
          external_examination_id?: number | null;
          external_examination_snapshot?: ExamSnapshot | null;
        })
      : null;
    const latestExamId = noteEvidenceRefs?.external_examination_id ?? null;
    const latestSnapshot = noteEvidenceRefs?.external_examination_snapshot ?? null;

    if (
      latestNote &&
      latestNote.source === "external_examinations" &&
      latestExamId === exam.id &&
      hasMeaningfulValue(latestNote.summary) &&
      hasMeaningfulValue(latestNote.assessment) &&
      hasMeaningfulValue(latestNote.plan) &&
      snapshotsMatch(latestSnapshot, currentSnapshot)
    ) {
      return NextResponse.json({ note: latestNote });
    }

    const prompt = buildPrompt(patientResult.rows[0] as PatientRow, exam);
    const generation = await generateClinicalNotesFromSoap(prompt);

    if (!generation.success || !generation.text) {
      return NextResponse.json({ error: generation.error || "Failed to generate clinical notes" }, { status: 500 });
    }

    const normalized = generation.text.replace(/\r/g, "");
    const summary = extractSection(normalized, ["SUMMARY", "RINGKASAN"]) || normalized.trim();
    let assessment = extractSection(normalized, ["ASSESSMENT", "PENILAIAN"]);
    let plan = extractSection(normalized, ["PLAN", "RENCANA"]);
    const medication = extractSection(normalized, ["MEDICATION", "REKOMENDASI OBAT", "OBAT"]);
    const triage = extractSection(normalized, ["TRIAGE_LEVEL", "TRIAGE"]);
    const diagnosesText = exam.diagnoses && exam.diagnoses.length > 0
      ? exam.diagnoses.map((item) => `${item.icd_code || "-"} - ${item.icd_name || "-"}`).join("; ")
      : "-";
    const primaryComplaint = inferPrimaryComplaint(exam.soap_subjective || "", exam.soap_objective || "", diagnosesText);

    if (primaryComplaint && hasContradictoryComplaint(`${assessment}\n${plan}`, primaryComplaint)) {
      assessment = `Keluhan utama ${primaryComplaint}, interpretasi klinis harus tetap konsisten dengan temuan SOAP terbaru.`;
      plan = `Observasi dan tata laksana sesuai keluhan utama ${primaryComplaint}, pertimbangkan evaluasi lanjutan bila keluhan menetap atau memberat.`;
    }

    const icdSummary = exam.diagnoses && exam.diagnoses.length > 0
      ? `ICD: ${exam.diagnoses.map((item) => `${item.icd_code || "-"} ${item.icd_name || "-"}`.trim()).join("; ")}`
      : "";
    const finalAssessment = assessment
      ? `${assessment}\n${icdSummary}`.trim()
      : (icdSummary || "-");

    const finalSummary = summary || "-";

    const updatedExamResult = await hospitalQuery(
      `UPDATE external_examinations
       SET soap_assessment = $1,
           soap_plan = $2,
           examination_notes = $3,
           result_received_at = COALESCE(result_received_at, NOW())
       WHERE id = $4
       RETURNING *`,
      [finalAssessment, plan || "-", finalSummary, exam.id]
    );

    const updatedExam = (updatedExamResult.rows[0] as ExternalExamination | undefined) ?? {
      ...exam,
      soap_assessment: finalAssessment,
      soap_plan: plan || "-",
      examination_notes: finalSummary,
    };

    const normalizedDiagnoses = normalizeDiagnoses(updatedExam.diagnoses ?? exam.diagnoses);
    const updatedSnapshot = buildExamSnapshot(updatedExam);

    const note = await createClinicalNote({
      patientId,
      doctorId: updatedExam.doctor_id ?? null,
      source: "external_examinations",
      status: "draft",
      summary: finalSummary,
      assessment: finalAssessment,
      plan: plan || "-",
      medicationRecommendation: medication || "-",
      triageLevel: triage || null,
      evidenceRefs: {
        external_examination_id: updatedExam.id,
        registration_id: registrationId,
        nurse_id: nurseId,
        generated_by: "agent",
        external_examination_snapshot: updatedSnapshot,
        icd: normalizedDiagnoses,
      },
    });

    return NextResponse.json({ examination: updatedExam, note, toolsUsed: generation.toolsUsed ?? [] }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate clinical notes";
    console.error("Clinical notes generation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
