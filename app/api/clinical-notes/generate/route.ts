import { NextResponse } from "next/server";

import { generateClinicalNotesFromSoap } from "@/lib/agent";
import { createClinicalNote, getLatestClinicalNote } from "@/lib/clinical-notes";
import { hospitalQuery } from "@/lib/hospital-db";
import { getCurrentPerawat } from "@/lib/nurse-auth";

type ExternalDiagnosis = {
  icd_code?: string;
  icd_name?: string;
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

type PatientRow = {
  id: number;
  no_rm?: string | null;
  full_name?: string | null;
  date_of_birth?: string | null;
  phone?: string | null;
  email?: string | null;
  medical_record?: string | null;
};

function buildPrompt(patient: PatientRow, exam: ExternalExamination) {
  const patientName = patient.full_name || "Pasien";
  const patientMrn = patient.no_rm || "-";

  const diagnosesText = exam.diagnoses && exam.diagnoses.length > 0
    ? exam.diagnoses.map((item) => `${item.icd_code || "-"} - ${item.icd_name || "-"}`).join("; ")
    : "-";

  return `Anda adalah perawat triase. Buat clinical notes singkat berdasarkan data berikut.\n\n` +
    `DATA PASIEN:\n` +
    `Nama: ${patientName}\n` +
    `NRM: ${patientMrn}\n` +
    `No HP: ${patient.phone || "-"}\n` +
    `Email: ${patient.email || "-"}\n\n` +
    `SOAP SUBJECTIVE:\n${exam.soap_subjective || "-"}\n\n` +
    `SOAP OBJECTIVE:\n${exam.soap_objective || "-"}\n\n` +
    `SOAP ASSESSMENT:\n${exam.soap_assessment || "-"}\n\n` +
    `SOAP PLAN:\n${exam.soap_plan || "-"}\n\n` +
    `DIAGNOSA ICD:\n${diagnosesText}\n\n` +
    `Aturan:\n` +
    `- Gunakan Bahasa Indonesia yang ringkas dan jelas.\n` +
    `- Jangan mencantumkan patient ID.\n` +
    `- Jangan mengarang data baru; gunakan '-' jika tidak ada informasi.\n\n` +
    `Output HARUS dengan format berikut (persis labelnya):\n` +
    `SUMMARY:\n...\n` +
    `ASSESSMENT:\n...\n` +
    `PLAN:\n...\n` +
    `MEDICATION:\n...\n` +
    `TRIAGE_LEVEL:\n...\n`;
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

    const exam = examResult.rows[0] as ExternalExamination;
    const latestNote = await getLatestClinicalNote(patientId, nurseId);
    const latestExamId = latestNote?.evidence_refs && typeof latestNote.evidence_refs === "object"
      ? (latestNote.evidence_refs as { external_examination_id?: number | null }).external_examination_id
      : null;

    if (latestNote && latestNote.source === "external_examinations" && latestExamId === exam.id) {
      return NextResponse.json({ note: latestNote });
    }

    const prompt = buildPrompt(patientResult.rows[0] as PatientRow, exam);
    const generation = await generateClinicalNotesFromSoap(prompt);

    if (!generation.success || !generation.text) {
      return NextResponse.json({ error: generation.error || "Failed to generate clinical notes" }, { status: 500 });
    }

    const normalized = generation.text.replace(/\r/g, "");
    const summary = extractSection(normalized, ["SUMMARY", "RINGKASAN"]) || normalized.trim();
    const assessment = extractSection(normalized, ["ASSESSMENT", "PENILAIAN"]);
    const plan = extractSection(normalized, ["PLAN", "RENCANA"]);
    const medication = extractSection(normalized, ["MEDICATION", "REKOMENDASI OBAT", "OBAT"]);
    const triage = extractSection(normalized, ["TRIAGE_LEVEL", "TRIAGE"]);

    const icdSummary = exam.diagnoses && exam.diagnoses.length > 0
      ? `ICD: ${exam.diagnoses.map((item) => `${item.icd_code || "-"} ${item.icd_name || "-"}`.trim()).join("; ")}`
      : "";
    const finalAssessment = assessment
      ? `${assessment}\n${icdSummary}`.trim()
      : (icdSummary || "-");

    const normalizedDiagnoses = (exam.diagnoses || []).map((item) => ({
      icd_code: item.icd_code || (item as { kode?: string }).kode || "-",
      icd_name: item.icd_name || (item as { nama?: string }).nama || "-",
    }));

    const note = await createClinicalNote({
      patientId,
      doctorId: exam.doctor_id ?? null,
      source: "external_examinations",
      status: "draft",
      summary: summary || "-",
      assessment: finalAssessment,
      plan: plan || "-",
      medicationRecommendation: medication || "-",
      triageLevel: triage || null,
      evidenceRefs: {
        external_examination_id: exam.id,
        registration_id: registrationId,
        nurse_id: nurseId,
        generated_by: "agent",
        icd: normalizedDiagnoses,
      },
    });

    return NextResponse.json({ note, toolsUsed: generation.toolsUsed ?? [] }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate clinical notes";
    console.error("Clinical notes generation error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
