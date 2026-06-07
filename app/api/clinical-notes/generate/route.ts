import { NextResponse } from "next/server";

import { generateClinicalNotesFromSoap } from "@/lib/agents/triage-agent";
import { saveAgentInteractionLog } from "@/lib/logging/agent-interaction-logs";
import {
  saveAgentDataSourceLogs,
  saveAgentPerformanceLog,
  type SaveAgentDataSourceLogInput,
} from "@/lib/logging/agent-observability-details";
import { createClinicalNote, getLatestClinicalNote } from "@/lib/clinical/clinical-notes";
import { hospitalQuery } from "@/lib/db/hospital-db";
import { buildMedicationRecommendation } from "@/lib/clinical/medication-recommendations";
import { getCurrentPerawat } from "@/lib/auth/nurse-auth";
import { getClinicalLlmConfig } from "@/lib/agents/llm-router";
import { regenerateSoapAssessmentPlan } from "@/lib/clinical/soap-followup";
import { resolveVisitContext } from "@/lib/clinical/visit-context";

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

type ChatNoteContext = {
  id: number;
  patient_condition?: string | null;
  summary?: string | null;
  assessment?: string | null;
  plan?: string | null;
  medication_recommendation?: string | null;
  triage_level?: string | null;
  evidence_refs?: Record<string, unknown> | null;
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

function formatValue(value?: string | number | null) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return String(value);
}

function buildPrompt(patient: PatientRow, exam: ExternalExamination, latestChatNote: ChatNoteContext | null) {
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
  const latestPatientCondition = latestChatNote?.patient_condition || "-";
  const latestChatSummary = latestChatNote?.summary || "-";
  const latestChatAssessment = latestChatNote?.assessment || "-";
  const latestChatPlan = latestChatNote?.plan || "-";
  const latestChatTriage = latestChatNote?.triage_level || "-";

  return `Anda adalah perawat triase. Buat clinical summary yang merangkum kondisi pasien berdasarkan data SOAP dari tabel external_examinations dan update triage chat terbaru pada kunjungan aktif.\n\n` +
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
    `UPDATE TRIASE CHAT TERBARU (kunjungan aktif):\n` +
    `KONDISI PASIEN TERBARU:\n${latestPatientCondition}\n\n` +
    `RINGKASAN TERBARU:\n${latestChatSummary}\n\n` +
    `ASSESSMENT TERBARU:\n${latestChatAssessment}\n\n` +
    `PLAN TERBARU:\n${latestChatPlan}\n\n` +
    `TRIAGE TERBARU:\n${latestChatTriage}\n\n` +
    `Aturan:\n` +
    `- PRIORITASKAN kondisi terbaru dari triage chat bila tersedia, lalu gabungkan dengan SOAP awal dokter.\n` +
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
    `- Jika triage chat terbaru berisi kondisi pasien yang lebih baru dari SOAP awal, gunakan itu sebagai keadaan terkini pasien.\n` +
    `- Hindari kalimat generik seperti "pasien dalam kondisi baik" kecuali memang didukung oleh temuan.\n\n` +
    `Output HARUS dengan format berikut (persis labelnya):\n` +
    `PATIENT_CONDITION:\nkondisi pasien terbaru\n` +
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

function parseEvidenceRefs(value: unknown) {
  if (!value) return null;
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}


async function persistInteractionLog(input: Parameters<typeof saveAgentInteractionLog>[0]) {
  try {
    return await saveAgentInteractionLog(input);
  } catch (error) {
    console.error("Failed to save /api/clinical-notes/generate interaction log:", error);
    return null;
  }
}

async function persistInteractionDetails(
  interactionLogId: number,
  entries: SaveAgentDataSourceLogInput[],
  performance: Parameters<typeof saveAgentPerformanceLog>[0]
) {
  try {
    await Promise.all([
      saveAgentDataSourceLogs(entries.map((entry) => ({ ...entry, interactionLogId }))),
      saveAgentPerformanceLog({ ...performance, interactionLogId }),
    ]);
  } catch (error) {
    console.error("Failed to save /api/clinical-notes/generate detail logs:", error);
  }
}

function buildClinicalGenerateDataSourceLogs(
  interactionLogId: number,
  patientId: number | null,
  registrationId: number | null,
  triageVisitId: number | null,
  nurseId: number | null,
  latestChatNoteId: number | null,
  examId: number | null,
  isCached: boolean
): SaveAgentDataSourceLogInput[] {
  const logs: SaveAgentDataSourceLogInput[] = [];

  if (patientId) {
    logs.push({
      interactionLogId,
      sourceCategory: "patient_master",
      tableName: "patients",
      fieldNames: ["id", "no_rm", "full_name", "date_of_birth", "phone", "email", "medical_record"],
      reason: "Mengambil identitas dasar pasien sebelum generate clinical notes.",
      recordIdentifier: `patient_id=${patientId}`,
      sourceSummary: "Master data pasien untuk clinical summary.",
    });
  }

  logs.push({
    interactionLogId,
    sourceCategory: "visit_context",
    tableName: "registrations",
    fieldNames: ["id", "patient_id", "status", "doctor_id", "updated_at", "created_at"],
    reason: "Menentukan registration aktif yang menjadi dasar clinical notes.",
    recordIdentifier: registrationId ? `registration_id=${registrationId}` : null,
    sourceSummary: "Konteks kunjungan aktif pasien.",
  });

  logs.push({
    interactionLogId,
    sourceCategory: "soap",
    tableName: "external_examinations",
    fieldNames: ["soap_subjective", "soap_objective", "soap_assessment", "soap_plan", "diagnoses", "examination_notes", "registration_id"],
    reason: "Mengambil SOAP awal dokter sebagai baseline generate clinical notes.",
    recordIdentifier: examId ? `exam_id=${examId}` : registrationId ? `registration_id=${registrationId}` : null,
    sourceSummary: isCached ? "SOAP dokter digunakan untuk validasi cache note yang ada." : "SOAP dokter digunakan sebagai baseline generate note baru.",
  });

  logs.push({
    interactionLogId,
    sourceCategory: "clinical_notes",
    tableName: "clinical_notes",
    fieldNames: ["patient_condition", "summary", "assessment", "plan", "medication_recommendation", "triage_level", "triage_visit_id", "registration_id"],
    reason: "Mengambil update triage chat terbaru dan/atau note terbaru sebagai konteks clinical summary.",
    recordIdentifier: latestChatNoteId ? `clinical_note_id=${latestChatNoteId}` : triageVisitId ? `triage_visit_id=${triageVisitId}` : null,
    sourceSummary: "Clinical notes terbaru pada kunjungan aktif.",
    metadata: { nurseId },
  });

  return logs;
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const clinicalLlmConfig = getClinicalLlmConfig();
  let logPerawat: Awaited<ReturnType<typeof getCurrentPerawat>> | null = null;
  let logPatientId: number | null = null;
  let logPatientName: string | null = null;
  let logPatientNoRm: string | null = null;
  let logRegistrationId: number | null = null;
  let logResolvedTriageVisitId: number | null = null;
  let logRequestMessage: string | null = null;
  let logNurseRecordId: number | null = null;

  try {
    const body = await request.json();
    const patientId = Number(body.patientId);
    const triageVisitId = body.triageVisitId !== undefined && body.triageVisitId !== null ? Number(body.triageVisitId) : null;
    logPatientId = Number.isFinite(patientId) ? patientId : null;
    logResolvedTriageVisitId = triageVisitId;
    logRequestMessage = Number.isFinite(patientId)
      ? `Generate clinical notes untuk patient ${patientId}`
      : "Generate clinical notes";

    if (!Number.isFinite(patientId)) {
      return NextResponse.json({ error: "patientId must be a number" }, { status: 400 });
    }

    const perawat = await getCurrentPerawat();
    logPerawat = perawat;
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
    logNurseRecordId = nurseId;

    const patientResult = await hospitalQuery(
      `SELECT id, no_rm, full_name, date_of_birth, phone, email, medical_record
       FROM patients
       WHERE id = $1`,
      [patientId]
    );

    if (patientResult.rows.length === 0) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    logPatientName = (patientResult.rows[0] as PatientRow).full_name ?? null;
    logPatientNoRm = (patientResult.rows[0] as PatientRow).no_rm ?? null;

    const visitContext = await resolveVisitContext(patientId, triageVisitId);
    const registrationId = visitContext.registrationId;
    logRegistrationId = registrationId ?? null;
    logResolvedTriageVisitId = visitContext.triageVisitId ?? logResolvedTriageVisitId;

    if (!registrationId) {
      const interactionLog = await persistInteractionLog({
        routeName: "/api/clinical-notes/generate",
        agentType: "clinical",
        requestKind: "generate_clinical_notes",
        nurseId: logPerawat?.id ?? null,
        nurseUsername: logPerawat?.username ?? null,
        nurseName: logPerawat?.namaLengkap ?? null,
        patientId: logPatientId,
        patientName: logPatientName,
        patientNoRm: logPatientNoRm,
        registrationId: logRegistrationId,
        triageVisitId: logResolvedTriageVisitId,
        intent: "generate_clinical_notes",
        requestMessage: logRequestMessage,
        responseMessage: null,
        success: false,
        errorMessage: "no_registration",
        latencyMs: Date.now() - startedAt,
        metadata: { reason: "no_registration", modelsUsed: [clinicalLlmConfig.displayName], primaryModel: clinicalLlmConfig.displayName },
      });
      if (interactionLog) {
        await persistInteractionDetails(
          interactionLog.id,
          buildClinicalGenerateDataSourceLogs(interactionLog.id, logPatientId, logRegistrationId, logResolvedTriageVisitId, logNurseRecordId, null, null, false),
          {
            interactionLogId: interactionLog.id,
            routeName: "/api/clinical-notes/generate",
            agentType: "clinical",
            totalLatencyMs: Date.now() - startedAt,
            success: false,
            errorMessage: "no_registration",
            metadata: { reason: "no_registration", modelsUsed: [clinicalLlmConfig.displayName], primaryModel: clinicalLlmConfig.displayName },
          }
        );
      }
      return NextResponse.json({ note: null, reason: "no_registration" });
    }
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
      const interactionLog = await persistInteractionLog({
        routeName: "/api/clinical-notes/generate",
        agentType: "clinical",
        requestKind: "generate_clinical_notes",
        nurseId: logPerawat?.id ?? null,
        nurseUsername: logPerawat?.username ?? null,
        nurseName: logPerawat?.namaLengkap ?? null,
        patientId: logPatientId,
        patientName: logPatientName,
        patientNoRm: logPatientNoRm,
        registrationId: logRegistrationId,
        triageVisitId: logResolvedTriageVisitId,
        intent: "generate_clinical_notes",
        requestMessage: logRequestMessage,
        responseMessage: null,
        success: false,
        errorMessage: "no_soap",
        latencyMs: Date.now() - startedAt,
        metadata: { reason: "no_soap", modelsUsed: [clinicalLlmConfig.displayName], primaryModel: clinicalLlmConfig.displayName },
      });
      if (interactionLog) {
        await persistInteractionDetails(
          interactionLog.id,
          buildClinicalGenerateDataSourceLogs(interactionLog.id, logPatientId, logRegistrationId, logResolvedTriageVisitId, logNurseRecordId, null, null, false),
          {
            interactionLogId: interactionLog.id,
            routeName: "/api/clinical-notes/generate",
            agentType: "clinical",
            totalLatencyMs: Date.now() - startedAt,
            success: false,
            errorMessage: "no_soap",
            metadata: { reason: "no_soap", modelsUsed: [clinicalLlmConfig.displayName], primaryModel: clinicalLlmConfig.displayName },
          }
        );
      }
      return NextResponse.json({ note: null, reason: "no_soap" });
    }

    let exam = examResult.rows[0] as ExternalExamination;

    const latestChatNoteResult = await hospitalQuery(
      `SELECT id, patient_condition, summary, assessment, plan, medication_recommendation, triage_level, evidence_refs, created_at
       FROM clinical_notes
       WHERE patient_id = $1
         AND source = 'chat'
         AND evidence_refs->>'nurse_id' = $2
         AND triage_visit_id = $3
       ORDER BY created_at DESC, id DESC
       LIMIT 1`,
      [patientId, String(nurseId), visitContext.triageVisitId ?? 0]
    );

    const latestChatNote = latestChatNoteResult.rows[0]
      ? ({
          ...latestChatNoteResult.rows[0],
          evidence_refs: parseEvidenceRefs(latestChatNoteResult.rows[0].evidence_refs),
        } as ChatNoteContext)
      : null;

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
    const latestNote = await getLatestClinicalNote(patientId, nurseId, registrationId, visitContext.triageVisitId ?? null);
    const noteEvidenceRefs = latestNote?.evidence_refs && typeof latestNote.evidence_refs === "object"
      ? (latestNote.evidence_refs as {
          external_examination_id?: number | null;
          external_examination_snapshot?: ExamSnapshot | null;
        })
      : null;
    const latestExamId = noteEvidenceRefs?.external_examination_id ?? null;
    const latestSnapshot = noteEvidenceRefs?.external_examination_snapshot ?? null;

    const latestChatAt = latestChatNote?.created_at ? new Date(latestChatNote.created_at).getTime() : 0;
    const latestExternalNoteAt = latestNote?.created_at ? new Date(latestNote.created_at).getTime() : 0;
    const hasNewerChatContext = latestChatAt > latestExternalNoteAt;

    if (
      latestNote &&
      latestNote.source === "external_examinations" &&
      latestExamId === exam.id &&
      hasMeaningfulValue(latestNote.summary) &&
      hasMeaningfulValue(latestNote.assessment) &&
      hasMeaningfulValue(latestNote.plan) &&
      snapshotsMatch(latestSnapshot, currentSnapshot) &&
      !hasNewerChatContext
    ) {
      const interactionLog = await persistInteractionLog({
        routeName: "/api/clinical-notes/generate",
        agentType: "clinical",
        requestKind: "generate_clinical_notes",
        nurseId: logPerawat?.id ?? null,
        nurseUsername: logPerawat?.username ?? null,
        nurseName: logPerawat?.namaLengkap ?? null,
        patientId: logPatientId,
        patientName: logPatientName,
        patientNoRm: logPatientNoRm,
        registrationId: logRegistrationId,
        triageVisitId: logResolvedTriageVisitId,
        intent: "generate_clinical_notes",
        requestMessage: logRequestMessage,
        responseMessage: latestNote.summary ?? "Menggunakan clinical note cached",
        success: true,
        latencyMs: Date.now() - startedAt,
        metadata: { cached: true, noteId: latestNote.id, modelsUsed: [clinicalLlmConfig.displayName], primaryModel: clinicalLlmConfig.displayName },
      });
      if (interactionLog) {
        await persistInteractionDetails(
          interactionLog.id,
          buildClinicalGenerateDataSourceLogs(interactionLog.id, logPatientId, logRegistrationId, logResolvedTriageVisitId, logNurseRecordId, latestNote.id, latestExamId, true),
          {
            interactionLogId: interactionLog.id,
            routeName: "/api/clinical-notes/generate",
            agentType: "clinical",
            totalLatencyMs: Date.now() - startedAt,
            success: true,
            metadata: { cached: true, noteId: latestNote.id, examId: latestExamId, modelsUsed: [clinicalLlmConfig.displayName], primaryModel: clinicalLlmConfig.displayName },
          }
        );
      }
      return NextResponse.json({ note: latestNote });
    }

    const prompt = buildPrompt(patientResult.rows[0] as PatientRow, exam, latestChatNote);
    const llmStartedAt = Date.now();
    const generation = await generateClinicalNotesFromSoap(prompt);
    const llmLatencyMs = Date.now() - llmStartedAt;

    if (!generation.success || !generation.text) {
      const interactionLog = await persistInteractionLog({
        routeName: "/api/clinical-notes/generate",
        agentType: "clinical",
        requestKind: "generate_clinical_notes",
        nurseId: logPerawat?.id ?? null,
        nurseUsername: logPerawat?.username ?? null,
        nurseName: logPerawat?.namaLengkap ?? null,
        patientId: logPatientId,
        patientName: logPatientName,
        patientNoRm: logPatientNoRm,
        registrationId: logRegistrationId,
        triageVisitId: logResolvedTriageVisitId,
        intent: "generate_clinical_notes",
        requestMessage: logRequestMessage,
        responseMessage: null,
        success: false,
        errorMessage: generation.error || "Failed to generate clinical notes",
        toolsUsed: generation.toolsUsed ?? [],
        latencyMs: Date.now() - startedAt,
        metadata: { modelsUsed: [clinicalLlmConfig.displayName], primaryModel: clinicalLlmConfig.displayName },
      });
      if (interactionLog) {
        await persistInteractionDetails(
          interactionLog.id,
          buildClinicalGenerateDataSourceLogs(interactionLog.id, logPatientId, logRegistrationId, logResolvedTriageVisitId, logNurseRecordId, latestChatNote?.id ?? null, exam.id, false),
          {
            interactionLogId: interactionLog.id,
            routeName: "/api/clinical-notes/generate",
            agentType: "clinical",
            totalLatencyMs: Date.now() - startedAt,
            llmLatencyMs,
            toolLatencyMs: generation.toolsUsed?.length ? llmLatencyMs : 0,
            success: false,
            errorMessage: generation.error || "Failed to generate clinical notes",
            metadata: { toolsUsed: generation.toolsUsed ?? [], modelsUsed: [clinicalLlmConfig.displayName], primaryModel: clinicalLlmConfig.displayName },
          }
        );
      }
      return NextResponse.json({ error: generation.error || "Failed to generate clinical notes" }, { status: 500 });
    }

    const normalized = generation.text.replace(/\r/g, "");
    const patientCondition = extractSection(normalized, ["PATIENT_CONDITION", "PATIENT CONDITION", "KONDISI_PASIEN", "KONDISI PASIEN"]) || latestChatNote?.patient_condition || '-';
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
    const finalMedication = medication && medication.trim() !== '-'
      ? medication
      : buildMedicationRecommendation({
          icd: normalizedDiagnoses,
          patientCondition,
          summary: finalSummary,
          assessment: finalAssessment,
          plan: plan || '-',
        });

    const note = await createClinicalNote({
      patientId,
      doctorId: updatedExam.doctor_id ?? null,
      triageVisitId: visitContext.triageVisitId ?? null,
      source: "external_examinations",
      status: "draft",
      patientCondition: patientCondition || latestChatNote?.patient_condition || null,
      summary: finalSummary,
      assessment: finalAssessment,
      plan: plan || "-",
      medicationRecommendation: finalMedication,
      triageLevel: triage || null,
      evidenceRefs: {
        external_examination_id: updatedExam.id,
        registration_id: registrationId,
        triage_visit_id: visitContext.triageVisitId ?? null,
        nurse_id: nurseId,
        generated_by: "agent",
        external_examination_snapshot: updatedSnapshot,
        latest_chat_note_id: latestChatNote?.id ?? null,
        latest_chat_note_summary: latestChatNote?.summary ?? null,
        latest_chat_note_assessment: latestChatNote?.assessment ?? null,
        latest_chat_note_plan: latestChatNote?.plan ?? null,
        latest_chat_note_triage: latestChatNote?.triage_level ?? null,
        icd: normalizedDiagnoses,
      },
    });

    const interactionLog = await persistInteractionLog({
      routeName: "/api/clinical-notes/generate",
      agentType: "clinical",
      requestKind: "generate_clinical_notes",
      nurseId: logPerawat?.id ?? null,
      nurseUsername: logPerawat?.username ?? null,
      nurseName: logPerawat?.namaLengkap ?? null,
      patientId: logPatientId,
      patientName: logPatientName,
      patientNoRm: logPatientNoRm,
      registrationId: logRegistrationId,
      triageVisitId: logResolvedTriageVisitId,
      intent: "generate_clinical_notes",
      requestMessage: logRequestMessage,
      responseMessage: note.summary ?? "Clinical note generated",
      success: true,
      toolsUsed: generation.toolsUsed ?? [],
      latencyMs: Date.now() - startedAt,
      metadata: { noteId: note.id, examId: updatedExam.id, modelsUsed: [clinicalLlmConfig.displayName], primaryModel: clinicalLlmConfig.displayName },
    });
    if (interactionLog) {
      await persistInteractionDetails(
        interactionLog.id,
        buildClinicalGenerateDataSourceLogs(interactionLog.id, logPatientId, logRegistrationId, logResolvedTriageVisitId, logNurseRecordId, latestChatNote?.id ?? null, updatedExam.id, false),
        {
          interactionLogId: interactionLog.id,
          routeName: "/api/clinical-notes/generate",
          agentType: "clinical",
          totalLatencyMs: Date.now() - startedAt,
          llmLatencyMs,
          toolLatencyMs: generation.toolsUsed?.length ? llmLatencyMs : 0,
          success: true,
          metadata: { noteId: note.id, examId: updatedExam.id, toolsUsed: generation.toolsUsed ?? [], modelsUsed: [clinicalLlmConfig.displayName], primaryModel: clinicalLlmConfig.displayName },
        }
      );
    }

    return NextResponse.json({ examination: updatedExam, note, toolsUsed: generation.toolsUsed ?? [] }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate clinical notes";
    console.error("Clinical notes generation error:", message);
    const interactionLog = await persistInteractionLog({
      routeName: "/api/clinical-notes/generate",
      agentType: "clinical",
      requestKind: "generate_clinical_notes",
      nurseId: logPerawat?.id ?? null,
      nurseUsername: logPerawat?.username ?? null,
      nurseName: logPerawat?.namaLengkap ?? null,
      patientId: logPatientId,
      patientName: logPatientName,
      patientNoRm: logPatientNoRm,
      registrationId: logRegistrationId,
      triageVisitId: logResolvedTriageVisitId,
      intent: "generate_clinical_notes",
      requestMessage: logRequestMessage,
      responseMessage: null,
      success: false,
      errorMessage: message,
      latencyMs: Date.now() - startedAt,
      metadata: { modelsUsed: [clinicalLlmConfig.displayName], primaryModel: clinicalLlmConfig.displayName },
    });
    if (interactionLog) {
      await persistInteractionDetails(
        interactionLog.id,
        buildClinicalGenerateDataSourceLogs(interactionLog.id, logPatientId, logRegistrationId, logResolvedTriageVisitId, logNurseRecordId, null, null, false),
        {
          interactionLogId: interactionLog.id,
          routeName: "/api/clinical-notes/generate",
          agentType: "clinical",
          totalLatencyMs: Date.now() - startedAt,
          success: false,
          errorMessage: message,
        }
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
