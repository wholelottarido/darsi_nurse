import { z } from 'zod';
import { createTool } from '@voltagent/core';
import { createClinicalNoteFromChatUpdate } from '@/lib/clinical/chat-clinical-updates';
import { searchClinicalIcdReferences } from '@/lib/clinical/icd-search';
import { hospitalQuery } from '@/lib/db/hospital-db';
import { getLatestClinicalNote } from '@/lib/clinical/clinical-notes';
import { regenerateSoapAssessmentPlan } from '@/lib/clinical/soap-followup';

type HospitalPatientRow = {
  id: number;
  no_rm?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  date_of_birth?: string | null;
  address?: string | null;
  ktp_number?: string | null;
  source?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  medical_record?: unknown;
  nama?: string | null;
  usia?: number | null;
  jenis_kelamin?: string | null;
  berat_badan?: number | null;
  tinggi_badan?: number | null;
  gol_darah?: string | null;
  alergi?: string | null;
  riwayat_penyakit?: string | null;
};

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

function getPatientAge(patient: HospitalPatientRow) {
  if (typeof patient.usia === 'number') {
    return patient.usia;
  }

  if (!patient.date_of_birth) {
    return null;
  }

  const dob = new Date(patient.date_of_birth);
  if (Number.isNaN(dob.getTime())) {
    return null;
  }

  return Math.floor((Date.now() - dob.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
}

function buildPatientSnapshot(patient: HospitalPatientRow) {
  const medicalRecord = parseMedicalRecord(patient.medical_record);

  const beratBadan =
    patient.berat_badan ??
    (medicalRecord.berat_badan as number | undefined) ??
    (medicalRecord.beratBadan as number | undefined) ??
    null;
  const tinggiBadan =
    patient.tinggi_badan ??
    (medicalRecord.tinggi_badan as number | undefined) ??
    (medicalRecord.tinggiBadan as number | undefined) ??
    null;
  const golDarah =
    patient.gol_darah ??
    (medicalRecord.gol_darah as string | undefined) ??
    (medicalRecord.golDarah as string | undefined) ??
    null;
  const alergi =
    patient.alergi ??
    (medicalRecord.alergi as string | undefined) ??
    (medicalRecord.allergies as string | undefined) ??
    null;
  const riwayatPenyakit =
    patient.riwayat_penyakit ??
    (medicalRecord.riwayat_penyakit as string | undefined) ??
    (medicalRecord.riwayatPenyakit as string | undefined) ??
    null;

  let bmi: string | null = null;
  if (beratBadan && tinggiBadan) {
    const heightM = Number(tinggiBadan) / 100;
    if (heightM > 0) {
      bmi = (Number(beratBadan) / (heightM * heightM)).toFixed(1);
    }
  }

  return {
    id: patient.id,
    nama: patient.full_name || patient.nama || 'Pasien',
    no_rm: patient.no_rm || '-',
    email: patient.email || '-',
    phone: patient.phone || '-',
    date_of_birth: patient.date_of_birth || null,
    usia: getPatientAge(patient),
    jenis_kelamin: patient.jenis_kelamin || '-',
    address: patient.address || '-',
    ktp_number: patient.ktp_number || '-',
    source: patient.source || '-',
    created_at: patient.created_at || null,
    updated_at: patient.updated_at || null,
    berat_badan: beratBadan,
    tinggi_badan: tinggiBadan,
    gol_darah: golDarah,
    alergi,
    riwayat_penyakit: riwayatPenyakit,
    bmi,
    medical_record: medicalRecord,
  };
}

async function getMedicalRecordColumnType() {
  const result = await hospitalQuery(
    `SELECT data_type
     FROM information_schema.columns
     WHERE table_name = 'patients' AND column_name = 'medical_record'
     LIMIT 1`
  );

  return (result.rows[0]?.data_type as string | undefined) || null;
}

type ExternalExaminationRow = {
  id: number;
  status?: string | null;
  soap_subjective?: string | null;
  soap_objective?: string | null;
  soap_assessment?: string | null;
  soap_plan?: string | null;
  diagnoses?: Array<{ icd_code?: string | null; icd_name?: string | null }> | null;
};

function extractIcdFromEvidenceRefs(value: unknown) {
  if (!value || typeof value !== 'object') {
    return [] as Array<{ icd_code?: string | null; icd_name?: string | null }>;
  }

  const icd = (value as { icd?: Array<{ icd_code?: string | null; icd_name?: string | null }> }).icd;
  return Array.isArray(icd) ? icd : [];
}

function formatActionSection(label: string, value?: string | null) {
  return `${label}:\n${value?.trim() || '-'}`;
}

function buildDiagnosisSummary(diagnoses?: Array<{ icd_code?: string | null; icd_name?: string | null }> | null) {
  if (!Array.isArray(diagnoses) || diagnoses.length === 0) {
    return '-';
  }

  return diagnoses
    .map((item) => `${item.icd_code || '-'} - ${item.icd_name || '-'}`)
    .join('; ');
}

function buildActionAdvice(triageLevel: string, summary: string, assessment: string, plan: string, allergies: string, diagnoses: string) {
  const normalizedTriage = triageLevel.toUpperCase();
  const actionLines: string[] = [];

  actionLines.push(`Kondisi ringkas: ${summary || '-'}`);
  actionLines.push(`Interpretasi klinis: ${assessment || '-'}`);
  actionLines.push(`Rencana SOAP: ${plan || '-'}`);
  actionLines.push(`Diagnosa ICD: ${diagnoses || '-'}`);

  if (normalizedTriage === 'URGENT') {
    actionLines.push('Tindakan: segera evaluasi dokter/IGD, monitor tanda vital, dan jangan pulangkan pasien sebelum stabil.');
  } else if (normalizedTriage === 'HIGH') {
    actionLines.push('Tindakan: konsultasi dokter segera, lakukan observasi ketat, dan siapkan eskalasi bila gejala memburuk.');
  } else if (normalizedTriage === 'MODERATE') {
    actionLines.push('Tindakan: observasi, berikan terapi simptomatik sesuai SOAP, dan jadwalkan review dokter bila perlu.');
  } else {
    actionLines.push('Tindakan: terapi suportif, edukasi red flags, dan kontrol ulang sesuai kondisi pasien.');
  }

  if (allergies && allergies !== '-') {
    actionLines.push(`Perhatian alergi: ${allergies}. Hindari obat/terapi yang berisiko menimbulkan reaksi alergi.`);
  }

  actionLines.push('Jika ada tanda bahaya seperti sesak, penurunan kesadaran, demam tinggi menetap, atau nyeri memberat, eskalasi segera.');

  return actionLines.join('\n');
}

async function buildPatientActionRecommendation(patientId: number) {
  const patientResult = await hospitalQuery(
    `SELECT id, no_rm, full_name, medical_record
     FROM patients
     WHERE id = $1`,
    [patientId]
  );

  if (patientResult.rows.length === 0) {
    return null;
  }

  const patient = buildPatientSnapshot(patientResult.rows[0] as HospitalPatientRow);
  const latestNote = await getLatestClinicalNote(patientId);

  const examResult = await hospitalQuery(
    `SELECT id, status, soap_subjective, soap_objective, soap_assessment, soap_plan, diagnoses
     FROM external_examinations
     WHERE patient_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [patientId]
  );

  const exam = (examResult.rows[0] as ExternalExaminationRow | undefined) ?? null;
  const triageLevel = (latestNote?.triage_level || exam?.status || 'LOW').toString();
  const noteDiagnoses = extractIcdFromEvidenceRefs(latestNote?.evidence_refs);

  const summary = latestNote?.summary?.trim()
    || [exam?.soap_subjective, exam?.soap_objective].filter(Boolean).join(' | ')
    || '-';
  const assessment = latestNote?.assessment?.trim() || exam?.soap_assessment?.trim() || '-';
  const plan = latestNote?.plan?.trim() || exam?.soap_plan?.trim() || '-';
  const diagnoses = buildDiagnosisSummary(noteDiagnoses.length > 0 ? noteDiagnoses : (exam?.diagnoses ?? null));
  const allergies = patient.alergi || '-';

  return [
    `REKOMENDASI TINDAKAN UNTUK ${patient.nama.toUpperCase()}`,
    `NRM: ${patient.no_rm || '-'}`,
    formatActionSection('SUMMARY', summary),
    formatActionSection('ASSESSMENT', assessment),
    formatActionSection('PLAN', plan),
    formatActionSection('MEDICATION', latestNote?.medication_recommendation || '-'),
    formatActionSection('TRIAGE_LEVEL', triageLevel.toUpperCase()),
    `DIAGNOSA ICD:\n${diagnoses}`,
    buildActionAdvice(triageLevel, summary, assessment, plan, allergies, diagnoses),
  ].join('\n\n');
}

export async function updateLatestSoapSubjective(patientId: number, subjective: string) {
  const patientResult = await hospitalQuery(
    `SELECT id, no_rm, full_name
     FROM patients
     WHERE id = $1`,
    [patientId]
  );

  if (patientResult.rows.length === 0) {
    return null;
  }

  const latestExamResult = await hospitalQuery(
    `SELECT id, patient_id, registration_id, soap_subjective, soap_objective, soap_assessment, soap_plan, diagnoses, status, doctor_username, created_at
     FROM external_examinations
     WHERE patient_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [patientId]
  );

  if (latestExamResult.rows.length === 0) {
    return null;
  }

  const updatedSubjective = subjective.trim();
  if (!updatedSubjective) {
    throw new Error('SOAP subjective cannot be empty');
  }

  const updateResult = await hospitalQuery(
    `UPDATE external_examinations
     SET soap_subjective = $1
     WHERE id = $2
     RETURNING id, patient_id, registration_id, soap_subjective, soap_objective, soap_assessment, soap_plan, diagnoses, status, doctor_username, created_at`,
    [updatedSubjective, latestExamResult.rows[0].id]
  );

  if (updateResult.rows.length === 0) {
    return null;
  }

  const refreshedFollowUp = await regenerateSoapAssessmentPlan(
    patientResult.rows[0].id as number,
    updateResult.rows[0].id as number
  );

  const updatedExam = refreshedFollowUp.success && refreshedFollowUp.updatedExam
    ? refreshedFollowUp.updatedExam
    : updateResult.rows[0];

  return {
    patient: {
      id: patientResult.rows[0].id as number,
      no_rm: patientResult.rows[0].no_rm ?? '-',
      full_name: patientResult.rows[0].full_name ?? 'Pasien',
    },
    updatedExam,
    soapFollowUp: refreshedFollowUp.success
      ? {
          assessment: refreshedFollowUp.assessment,
          plan: refreshedFollowUp.plan,
        }
      : null,
    soapFollowUpError: refreshedFollowUp.success ? null : refreshedFollowUp.error,
  };
}

// ============ HELPER: Search ICD (used by API + tool) ============
export async function searchIcdDiagnosa(symptoms: string, limit: number = 5) {
  console.log('🔎 searchIcdDiagnosa called with:', { symptoms, limit });

  const searchSymptom = symptoms.trim().split(/\s+/)[0] || symptoms.trim();
  try {
    const results = await searchClinicalIcdReferences(symptoms, limit);
    console.log(`📊 ICD query returned ${results.length} rows`);

    const recommendations = results.map((row) => ({
      code: row.icd_code,
      nameId: row.icd_name,
      nameEn: '-',
      triageLevel: row.triageLevel,
    }));

    // Sort by triage level
    const triagePriority = { URGENT: 0, HIGH: 1, MODERATE: 2, LOW: 3 };
    recommendations.sort((a, b) => 
      triagePriority[a.triageLevel as keyof typeof triagePriority] - 
      triagePriority[b.triageLevel as keyof typeof triagePriority]
    );

    const topTriageLevel = recommendations.length > 0 
      ? recommendations[0].triageLevel 
      : 'UNKNOWN';

    console.log(`✅ ICD search complete: ${recommendations.length} recommendations found, top triage: ${topTriageLevel}`);

    return {
      success: true,
      symptom_query: searchSymptom,
      recommendations,
      overall_triage_level: topTriageLevel,
      count: recommendations.length,
      summary: `Found ${recommendations.length} matching diagnoses. Top priority: ${topTriageLevel}`,
    };
  } catch (error) {
    console.error('❌ ICD search error:', error instanceof Error ? error.message : String(error));
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to search diagnosa',
    };
  }
}

// ============ TOOL 1: Search Patient ============
export const searchPatientTool = createTool({
  name: 'searchPatient',
  description: 'Search for a patient by name or medical record number',
  parameters: z.object({
    query: z.string().describe('Patient name or nomor rekam medis to search for'),
  }),
  execute: async (input: { query: string }) => {
    try {
      const result = await hospitalQuery(
        `SELECT id, no_rm, full_name, email, phone, date_of_birth, address, ktp_number, medical_record, source, created_at, updated_at
         FROM patients
         WHERE full_name ILIKE $1
            OR no_rm ILIKE $1
            OR email ILIKE $1
            OR phone ILIKE $1
            OR CAST(id AS TEXT) ILIKE $1
         ORDER BY created_at DESC
         LIMIT 10`,
        [`%${input.query}%`]
      );
      console.log('🔧 searchPatient executed:', { count: result.rows.length });
      return {
        success: true,
        patients: result.rows.map((row) => buildPatientSnapshot(row as HospitalPatientRow)),
        count: result.rows.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search patients',
      };
    }
  },
});

// ============ TOOL 2: Get Patient Health Summary ============
export const getPatientHealthSummaryTool = createTool({
  name: 'getPatientHealthSummary',
  description: 'Get complete health profile and medical data for a specific patient',
  parameters: z.object({
    patientId: z.coerce.number().int().positive().describe('Hospital CS patient ID'),
  }),
  execute: async (input: { patientId: number }) => {
    try {
      const patientResult = await hospitalQuery(
        `SELECT id, no_rm, full_name, email, phone, date_of_birth, address, ktp_number, medical_record, source, created_at, updated_at
         FROM patients
         WHERE id = $1`,
        [input.patientId]
      );

      if (patientResult.rows.length === 0) {
        return { success: false, error: 'Patient not found' };
      }

      const patient = buildPatientSnapshot(patientResult.rows[0] as HospitalPatientRow);

      console.log('🔧 getPatientHealthSummary executed:', { nama: patient.nama });
      
      return {
        success: true,
        patient,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get patient health summary',
      };
    }
  },
});

// ============ TOOL 3: Monitor Patient Status ============
export const monitorPatientStatusTool = createTool({
  name: 'monitorPatientStatus',
  description: 'Get real-time patient status including vital signs and conditions',
  parameters: z.object({
    patientId: z.coerce.number().int().positive().describe('Hospital CS patient ID'),
  }),
  execute: async (input: { patientId: number }) => {
    try {
      const result = await hospitalQuery(
        `SELECT id, no_rm, full_name, email, phone, date_of_birth, address, ktp_number, medical_record, source, created_at, updated_at
         FROM patients
         WHERE id = $1`,
        [input.patientId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Patient not found' };
      }

      console.log('🔧 monitorPatientStatus executed');
      
      return {
        success: true,
        status: buildPatientSnapshot(result.rows[0] as HospitalPatientRow),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to monitor patient status',
      };
    }
  },
});

// ============ TOOL 4: Update Patient Condition ============
export const updatePatientConditionTool = createTool({
  name: 'updatePatientCondition',
  description: 'Update patient medical condition data',
  parameters: z.object({
    patientId: z.coerce.number().int().positive().describe('Hospital CS patient ID'),
    field: z.enum(['berat_badan', 'tinggi_badan', 'gol_darah', 'alergi', 'riwayat_penyakit'])
      .describe('Field to update'),
    value: z.string().describe('New value'),
  }),
  execute: async (input: { patientId: number; field: string; value: string }) => {
    try {
      const patientResult = await hospitalQuery(
        `SELECT id, medical_record
         FROM patients
         WHERE id = $1`,
        [input.patientId]
      );

      if (patientResult.rows.length === 0) {
        return { success: false, error: 'Patient not found' };
      }

      const existingRecord = parseMedicalRecord(patientResult.rows[0].medical_record);
      const updatedRecord = {
        ...existingRecord,
        [input.field]: input.value,
      };

      const medicalRecordType = await getMedicalRecordColumnType();
      let result;

      if (medicalRecordType === 'jsonb' || medicalRecordType === 'json') {
        result = await hospitalQuery(
          `UPDATE patients
           SET medical_record = $1::${medicalRecordType}
           WHERE id = $2
           RETURNING *`,
          [JSON.stringify(updatedRecord), input.patientId]
        );
      } else if (medicalRecordType) {
        result = await hospitalQuery(
          `UPDATE patients
           SET medical_record = $1
           WHERE id = $2
           RETURNING *`,
          [JSON.stringify(updatedRecord), input.patientId]
        );
      } else {
        return {
          success: false,
          error: 'medical_record column not found on patients table',
        };
      }

      if (result.rows.length === 0) {
        return { success: false, error: 'Patient not found' };
      }

      console.log('🔧 updatePatientCondition executed:', { field: input.field });
      
      return {
        success: true,
        updated: buildPatientSnapshot(result.rows[0] as HospitalPatientRow),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update patient condition',
      };
    }
  },
});

// ============ TOOL 5: Get Patient Allergies ============
export const getPatientAllergiesTool = createTool({
  name: 'getPatientAllergies',
  description: 'Get patient allergies with warnings',
  parameters: z.object({
    patientId: z.coerce.number().int().positive().describe('Hospital CS patient ID'),
  }),
  execute: async (input: { patientId: number }) => {
    try {
      const result = await hospitalQuery(
        `SELECT id, no_rm, full_name, email, phone, date_of_birth, address, ktp_number, medical_record, source, created_at, updated_at
         FROM patients
         WHERE id = $1`,
        [input.patientId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Patient not found' };
      }

      const patient = buildPatientSnapshot(result.rows[0] as HospitalPatientRow);

      console.log('🔧 getPatientAllergies executed');
      
      return {
        success: true,
        allergies: {
          nama: patient.nama,
          alergi: patient.alergi,
        },
        warning: patient.alergi ? '⚠️ Patient has allergies' : 'No known allergies',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get patient allergies',
      };
    }
  },
});

// ============ TOOL 6: Get Patient Medical History ============
export const getPatientMedicalHistoryTool = createTool({
  name: 'getPatientMedicalHistory',
  description: 'Get patient medical history and blood type',
  parameters: z.object({
    patientId: z.coerce.number().int().positive().describe('Hospital CS patient ID'),
  }),
  execute: async (input: { patientId: number }) => {
    try {
      const result = await hospitalQuery(
        `SELECT id, no_rm, full_name, email, phone, date_of_birth, address, ktp_number, medical_record, source, created_at, updated_at
         FROM patients
         WHERE id = $1`,
        [input.patientId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Patient not found' };
      }

      const patient = buildPatientSnapshot(result.rows[0] as HospitalPatientRow);

      console.log('🔧 getPatientMedicalHistory executed');
      
      return {
        success: true,
        history: {
          nama: patient.nama,
          riwayat_penyakit: patient.riwayat_penyakit,
          gol_darah: patient.gol_darah,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get patient medical history',
      };
    }
  },
});

// ============ TOOL 7: Search Diagnosa with Triage Level ============
export const searchDiagnosaWithTriageTool = createTool({
  name: 'searchDiagnosaWithTriage',
  description: `CRITICAL: Use ONLY when patient reports symptoms or complaints (e.g., fever, headache, cough). Input: Patient symptoms in Indonesian or English (e.g., "demam 39°C", "high fever and headache", "sakit perut"). Output: Matching ICD-10 diagnosis codes with triage level (URGENT/HIGH/MODERATE/LOW). Examples: "demam" → A01.0, A01.1 (Typhoid); "meningitis" → A39.0 (Meningococcal infection).`,
  parameters: z.object({
    symptoms: z.string().describe('Patient symptoms or condition in Indonesian or English (e.g., "demam tinggi, sakit kepala", "high fever, headache")'),
    limit: z.number().optional().describe('Max results to return (default 5)'),
  }),
  execute: async (input: { symptoms: string; limit?: number }) => {
    console.log('🚀 searchDiagnosaWithTriageTool.execute called with:', input);
    const resultLimit = input.limit || 5;
    const result = await searchIcdDiagnosa(input.symptoms, resultLimit);
    
    console.log('📤 searchDiagnosaWithTriageTool returning:', {
      success: result.success,
      count: result.count,
      hasError: !!result.error
    });
    
    return result;
  },
});

// ============ TOOL 8: Action Recommendation from SOAP + ICD ============
export const getPatientActionRecommendationTool = createTool({
  name: 'getPatientActionRecommendation',
  description: 'Get recommended next actions for a patient based on SOAP notes, ICD diagnoses, and patient context',
  parameters: z.object({
    patientId: z.coerce.number().int().positive().describe('Hospital CS patient ID'),
  }),
  execute: async (input: { patientId: number }) => {
    try {
      const recommendation = await buildPatientActionRecommendation(input.patientId);

      if (!recommendation) {
        return { success: false, error: 'Patient not found' };
      }

      return {
        success: true,
        recommendation,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to build action recommendation',
      };
    }
  },
});

// ============ TOOL 9: Update SOAP Subjective ==========
export const updateSoapSubjectiveTool = createTool({
  name: 'updateSoapSubjective',
  description: 'Save triage chat condition updates into clinical_notes without changing external_examinations',
  parameters: z.object({
    patientId: z.coerce.number().int().positive().describe('Hospital CS patient ID'),
    subjective: z.string().min(3).describe('Updated patient condition or complaint notes from triage chat'),
  }),
  execute: async (input: { patientId: number; subjective: string }) => {
    try {
      const result = await createClinicalNoteFromChatUpdate({
        patientId: input.patientId,
        updateKind: 'subjective',
        updateText: input.subjective,
      });

      if (!result?.note) {
        return { success: false, error: 'Patient not found' };
      }

      return {
        success: true,
        patient: result.patient,
        note: result.note,
        icd: result.icd,
        message: 'Triage chat update berhasil disimpan ke clinical notes tanpa mengubah external_examinations',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save chat clinical update',
      };
    }
  },
});

// ============ EXPORT ALL TOOLS AS ARRAY ============
export const agentTools = [
  searchPatientTool,
  getPatientHealthSummaryTool,
  monitorPatientStatusTool,
  updatePatientConditionTool,
  getPatientAllergiesTool,
  getPatientMedicalHistoryTool,
  searchDiagnosaWithTriageTool,
  getPatientActionRecommendationTool,
  updateSoapSubjectiveTool,
];

export async function getPatientActionRecommendation(patientId: number) {
  return buildPatientActionRecommendation(patientId);
}
