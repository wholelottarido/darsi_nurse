import { Agent } from '@voltagent/core';

import { hospitalQuery } from '@/lib/hospital-db';
import { getChatModel, getResolvedLlmConfig } from '@/lib/llm';

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
  berat_badan?: number | null;
  tinggi_badan?: number | null;
  alergi?: string | null;
  riwayat_penyakit?: string | null;
  medical_record?: unknown;
};

type ExternalExaminationRow = {
  id: number;
  patient_id: number;
  registration_id?: number | null;
  status?: string | null;
  soap_subjective?: string | null;
  soap_objective?: string | null;
  soap_assessment?: string | null;
  soap_plan?: string | null;
  diagnoses?: ExternalDiagnosis[] | null;
  doctor_username?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type SoapFollowUpResult = {
  success: boolean;
  assessment?: string;
  plan?: string;
  updatedExam?: ExternalExaminationRow | null;
  error?: string;
};

const soapModel = getChatModel();

let soapFollowUpAgent: Agent | null = null;

function parseMedicalRecord(value: unknown) {
  if (!value) {
    return {} as Record<string, unknown>;
  }

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
      return {} as Record<string, unknown>;
    }
  }

  return {} as Record<string, unknown>;
}

function getPatientAge(patient: PatientRow) {
  if (!patient.date_of_birth) {
    return null;
  }

  const dob = new Date(patient.date_of_birth);
  if (Number.isNaN(dob.getTime())) {
    return null;
  }

  return Math.floor((Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

function buildPatientContext(patient: PatientRow) {
  const medicalRecord = parseMedicalRecord(patient.medical_record);

  return {
    nama: patient.full_name || 'Pasien',
    no_rm: patient.no_rm || '-',
    usia: getPatientAge(patient),
    jenis_kelamin: patient.jenis_kelamin || '-',
    alergi:
      patient.alergi ||
      (medicalRecord.alergi as string | undefined) ||
      (medicalRecord.allergies as string | undefined) ||
      '-',
    riwayat_penyakit:
      patient.riwayat_penyakit ||
      (medicalRecord.riwayat_penyakit as string | undefined) ||
      (medicalRecord.riwayatPenyakit as string | undefined) ||
      '-',
    berat_badan:
      patient.berat_badan ??
      (medicalRecord.berat_badan as number | undefined) ??
      (medicalRecord.beratBadan as number | undefined) ??
      null,
    tinggi_badan:
      patient.tinggi_badan ??
      (medicalRecord.tinggi_badan as number | undefined) ??
      (medicalRecord.tinggiBadan as number | undefined) ??
      null,
  };
}

function buildDiagnosisText(diagnoses?: ExternalDiagnosis[] | null) {
  if (!Array.isArray(diagnoses) || diagnoses.length === 0) {
    return '-';
  }

  return diagnoses
    .map((item) => `${item.icd_code || '-'} - ${item.icd_name || '-'}`)
    .join('; ');
}

function normalizeText(value?: string | null) {
  return (value || '').toLowerCase();
}

function inferPrimaryComplaint(subjective: string, objective: string, diagnosisText: string) {
  const combined = `${subjective} ${objective} ${diagnosisText}`.toLowerCase();

  const complaintRules = [
    {
      label: 'sakit perut',
      hints: ['sakit perut', 'nyeri perut', 'perut sakit', 'abdomen nyeri', 'nyeri abdomen', 'abdominal pain', 'perut kembung', 'maag', 'mules'],
    },
    {
      label: 'sakit kepala',
      hints: ['sakit kepala', 'nyeri kepala', 'pusing', 'cephalgia', 'headache'],
    },
    {
      label: 'diare',
      hints: ['diare', 'mencret', 'buang air besar cair', 'feses cair', 'diarrhea'],
    },
    {
      label: 'mual muntah',
      hints: ['mual', 'muntah', 'nausea', 'vomit', 'vomiting'],
    },
    {
      label: 'batuk',
      hints: ['batuk', 'cough'],
    },
    {
      label: 'demam',
      hints: ['demam', 'fever', 'panas'],
    },
    {
      label: 'sesak napas',
      hints: ['sesak', 'sesak napas', 'dyspnea', 'shortness of breath'],
    },
    {
      label: 'nyeri dada',
      hints: ['nyeri dada', 'sakit dada', 'chest pain'],
    },
  ];

  for (const rule of complaintRules) {
    if (rule.hints.some((hint) => combined.includes(hint))) {
      return rule.label;
    }
  }

  return null;
}

function hasContradictoryComplaint(text: string, primaryComplaint: string | null) {
  if (!primaryComplaint) {
    return false;
  }

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
    return 'Keluhan utama tidak terdeteksi dengan jelas dari data yang tersedia.';
  }

  return [
    `Keluhan utama yang harus dipertahankan: ${primaryComplaint}.`,
    `Jangan ubah fokus anatomi atau keluhan utama menjadi keluhan lain yang berbeda.`,
    `Jika primary complaint adalah ${primaryComplaint}, assessment dan plan wajib tetap membahas keluhan itu.`,
  ].join(' ');
}

function formatSection(label: string, value?: string | null) {
  return `${label}:\n${value?.trim() || '-'}`;
}

function extractSection(text: string, labels: string[]) {
  for (const label of labels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`${escaped}\\s*:\\s*([\\s\\S]*?)(?=\\n[A-Z][A-Z_ ]+\\s*:\\s*|$)`, 'i');
    const match = text.match(regex);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  return '';
}

async function getSoapFollowUpAgent() {
  if (soapFollowUpAgent) {
    return soapFollowUpAgent;
  }

  const llmConfig = getResolvedLlmConfig();

  console.log('🧠 SOAP follow-up model:', llmConfig.model);

  soapFollowUpAgent = new Agent({
    name: 'SOAP Follow-up Generator',
    instructions: `Anda adalah asisten klinis yang bertugas mengisi SOAP ASSESSMENT dan SOAP PLAN.

Aturan wajib:
- Gunakan hanya data pasien dan SOAP terbaru yang diberikan.
- Jangan mengarang diagnosis baru yang tidak didukung data.
- Pertimbangkan alergi, riwayat penyakit, dan status pasien.
- Assessment harus berisi interpretasi klinis singkat.
- Plan harus berisi langkah tindak lanjut yang aman dan relevan.
- Jika data terbatas, tetap buat rekomendasi konservatif berdasarkan informasi yang ada.
- Gunakan Bahasa Indonesia yang ringkas, jelas, dan klinis.
- Jangan tampilkan markdown, nomor, atau penjelasan meta.
- Pertahankan keluhan utama dan anatomi sesuai data input; jangan menggeser sakit perut menjadi sakit kepala atau sebaliknya.
- Output harus persis dalam format berikut:
ASSESSMENT:
...
PLAN:
...
`,
    model: soapModel,
    maxSteps: 1,
    temperature: 0.1,
  });

  return soapFollowUpAgent;
}

async function fetchSoapContext(patientId: number, examId?: number) {
  const patientResult = await hospitalQuery(
    `SELECT id, no_rm, full_name, date_of_birth, jenis_kelamin, berat_badan, tinggi_badan, alergi, riwayat_penyakit, medical_record
     FROM patients
     WHERE id = $1
     LIMIT 1`,
    [patientId]
  );

  if (patientResult.rows.length === 0) {
    return null;
  }

  const examResult = examId
    ? await hospitalQuery(
        `SELECT id, patient_id, registration_id, status, soap_subjective, soap_objective, soap_assessment, soap_plan, diagnoses, doctor_username, created_at, updated_at
         FROM external_examinations
         WHERE id = $1 AND patient_id = $2
         LIMIT 1`,
        [examId, patientId]
      )
    : await hospitalQuery(
        `SELECT id, patient_id, registration_id, status, soap_subjective, soap_objective, soap_assessment, soap_plan, diagnoses, doctor_username, created_at, updated_at
         FROM external_examinations
         WHERE patient_id = $1
         ORDER BY created_at DESC
         LIMIT 1`,
        [patientId]
      );

  if (examResult.rows.length === 0) {
    return null;
  }

  return {
    patient: patientResult.rows[0] as PatientRow,
    exam: examResult.rows[0] as ExternalExaminationRow,
  };
}

export async function regenerateSoapAssessmentPlan(patientId: number, examId?: number): Promise<SoapFollowUpResult> {
  try {
    const context = await fetchSoapContext(patientId, examId);
    if (!context) {
      return { success: false, error: 'Patient or external examination not found', updatedExam: null };
    }

    const { patient, exam } = context;
    const subjective = exam.soap_subjective?.trim() || '';
    const objective = exam.soap_objective?.trim() || '';

    if (!subjective && !objective) {
      return {
        success: false,
        error: 'SOAP subjective dan objective belum tersedia untuk dijadikan dasar assessment/plan',
        updatedExam: exam,
      };
    }

    const diagnosisText = buildDiagnosisText(exam.diagnoses ?? null);
    const patientContext = buildPatientContext(patient);
    const primaryComplaint = inferPrimaryComplaint(subjective, objective, diagnosisText);
    const complaintAnchors = buildComplaintAnchors(primaryComplaint);

    const prompt = [
      'Buat SOAP ASSESSMENT dan SOAP PLAN berdasarkan data pasien berikut.',
      '',
      `DATA PASIEN:`,
      `Nama: ${patientContext.nama}`,
      `NRM: ${patientContext.no_rm}`,
      `Usia: ${patientContext.usia ?? '-'}`,
      `Jenis Kelamin: ${patientContext.jenis_kelamin}`,
      `BB: ${patientContext.berat_badan ?? '-'}`,
      `TB: ${patientContext.tinggi_badan ?? '-'}`,
      `Alergi: ${patientContext.alergi}`,
      `Riwayat Penyakit: ${patientContext.riwayat_penyakit}`,
      '',
      `SOAP SUBJECTIVE:`,
      subjective || '-',
      '',
      `SOAP OBJECTIVE:`,
      objective || '-',
      '',
      `KELUHAN UTAMA TERDETEKSI:`,
      primaryComplaint || '-',
      '',
      complaintAnchors,
      '',
      `SOAP ASSESSMENT SAAT INI:`,
      exam.soap_assessment || '-',
      '',
      `SOAP PLAN SAAT INI:`,
      exam.soap_plan || '-',
      '',
      `DIAGNOSA ICD:`,
      diagnosisText,
      '',
      `STATUS:`,
      exam.status || '-',
      '',
      'Instruksi:',
      '- Gunakan data terbaru di atas.',
      '- Jika subjective dan objective mengarah ke kondisi tertentu, assessment harus merangkum interpretasi klinisnya.',
      '- Plan harus sesuai kondisi pasien, aman, dan mempertimbangkan alergi/riwayat.',
      '- Jika keluhan utama terdeteksi, wajib gunakan keluhan itu secara konsisten di assessment dan plan.',
      '- Jangan menyalin subjective/objective mentah.',
      '- Jangan menambahkan diagnosis baru yang tidak didukung data.',
      '',
      'Output wajib:',
      'ASSESSMENT:',
      '...',
      'PLAN:',
      '...',
    ].join('\n');

    const agent = await getSoapFollowUpAgent();
    const result = await agent.generateText(
      [
        {
          role: 'user',
          content: prompt,
        },
      ],
      {
        maxOutputTokens: 800,
        maxSteps: 1,
        temperature: 0.1,
      }
    );

    const rawText = await result.text;
    const normalized = rawText.replace(/\r/g, '');
    let assessment = extractSection(normalized, ['ASSESSMENT', 'PENILAIAN']).trim();
    let plan = extractSection(normalized, ['PLAN', 'RENCANA']).trim();

    if (primaryComplaint && hasContradictoryComplaint(`${assessment}\n${plan}`, primaryComplaint)) {
      const retryPrompt = [
        prompt,
        '',
        'Peringatan koreksi:',
        `Output sebelumnya keliru karena tidak konsisten dengan keluhan utama "${primaryComplaint}".`,
        `Wajib revisi dan fokus hanya pada "${primaryComplaint}".`,
        'Jangan menyebut keluhan anatomi lain yang berbeda.',
      ].join('\n');

      const retryResult = await agent.generateText(
        [
          {
            role: 'user',
            content: retryPrompt,
          },
        ],
        {
          maxOutputTokens: 800,
          maxSteps: 1,
          temperature: 0,
        }
      );

      const retryText = (await retryResult.text).replace(/\r/g, '');
      const retryAssessment = extractSection(retryText, ['ASSESSMENT', 'PENILAIAN']).trim();
      const retryPlan = extractSection(retryText, ['PLAN', 'RENCANA']).trim();

      if (retryAssessment) assessment = retryAssessment;
      if (retryPlan) plan = retryPlan;
    }

    if (!assessment || !plan) {
      return {
        success: false,
        error: 'LLM tidak mengembalikan format ASSESSMENT/PLAN yang valid',
        updatedExam: exam,
      };
    }

    if (primaryComplaint && hasContradictoryComplaint(`${assessment}\n${plan}`, primaryComplaint)) {
      assessment = `Keluhan utama ${primaryComplaint}, perlu interpretasi klinis sesuai temuan SOAP terbaru dan evaluasi penyebab yang paling mungkin.`;
      plan = `Observasi dan tata laksana sesuai keluhan utama ${primaryComplaint}, pertimbangkan evaluasi lanjutan bila keluhan menetap atau memberat.`;
    }

    const updateResult = await hospitalQuery(
      `UPDATE external_examinations
       SET soap_assessment = $1,
           soap_plan = $2
       WHERE id = $3
       RETURNING id, patient_id, registration_id, status, soap_subjective, soap_objective, soap_assessment, soap_plan, diagnoses, doctor_username, created_at, updated_at`,
      [assessment, plan, exam.id]
    );

    return {
      success: true,
      assessment,
      plan,
      updatedExam: (updateResult.rows[0] as ExternalExaminationRow | undefined) ?? {
        ...exam,
        soap_assessment: assessment,
        soap_plan: plan,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to regenerate SOAP assessment and plan',
      updatedExam: null,
    };
  }
}

export function formatSoapFollowUpPreview(result?: SoapFollowUpResult | null) {
  if (!result?.success) {
    return null;
  }

  return [
    formatSection('ASSESSMENT', result.assessment),
    formatSection('PLAN', result.plan),
  ].join('\n\n');
}
