import { z } from 'zod';
import { createTool } from '@voltagent/core';
import { Client } from 'pg';
import { hospitalQuery } from '@/lib/hospital-db';

// ============ DATABASE CONNECTION ============

function getDbClient() {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('DATABASE_URL not configured');
  }
  
  return new Client({
    connectionString,
  });
}

// ============ HELPER: Search ICD (used by API + tool) ============
export async function searchIcdDiagnosa(symptoms: string, limit: number = 5) {
  console.log('🔎 searchIcdDiagnosa called with:', { symptoms, limit });
  
  // Extract key symptoms from the input
  // Map common symptom phrases to keywords that exist in database
  const symptomMappings: { [key: string]: string[] } = {
    'demam': ['demam', 'fever', 'suhu tinggi', 'panas'],
    'sakit kepala': ['sakit kepala', 'headache', 'kepala', 'pusing'],
    'batuk': ['batuk', 'cough', 'batuk-batuk'],
    'diare': ['diare', 'diarrhea', 'mencret', 'buang air besar'],
    'mual': ['mual', 'nausea', 'muntah', 'vomit'],
    'nyeri': ['nyeri', 'pain', 'sakit', 'perut'],
    'infeksi': ['infeksi', 'infection', 'radang', 'inflammation'],
    'meningitis': ['meningitis', 'selaput otak'],
    'pneumonia': ['pneumonia', 'paru-paru', 'radang paru'],
  };
  
  // Extract symptoms from input
  const extractedSymptoms: string[] = [];
  const lowerInput = symptoms.toLowerCase();
  
  for (const [key, phrases] of Object.entries(symptomMappings)) {
    if (phrases.some(phrase => lowerInput.includes(phrase))) {
      extractedSymptoms.push(key);
    }
  }
  
  const searchSymptom = extractedSymptoms.length > 0 
    ? extractedSymptoms[0]  // Use first extracted symptom
    : symptoms.split(/\s+/)[0]; // Fallback to first word
  
  console.log(`✨ Extracted symptoms: [${extractedSymptoms.join(', ')}], searching with: "${searchSymptom}"`);
  
  try {
    // Search ICD codes matching symptoms
    const searchQuery = `%${searchSymptom}%`;
    console.log('🔍 Searching ICD with pattern:', searchQuery);
    
    const result = await hospitalQuery(
      `SELECT kode, nama FROM darsi_icd
       WHERE nama ILIKE $1 OR kode ILIKE $1
       ORDER BY
         CASE
           WHEN nama ILIKE $1 THEN 1
           WHEN kode ILIKE $1 THEN 2
           ELSE 3
         END
       LIMIT $2`,
      [searchQuery, limit]
    );

    console.log(`📊 ICD query returned ${result.rows.length} rows`);

    // Assign triage level based on keywords
    const assignTriageLevel = (nameId: string, nameEn: string, code: string): string => {
      const combinedText = `${nameId} ${nameEn} ${code}`.toLowerCase();
      
      // URGENT keywords
      const urgentKeywords = ['septikemia', 'septicaemia', 'shock', 'respiratory', 'respira', 'meningitis', 
                            'encephalitis', 'ensefalitis', 'stroke', 'cerebral', 'hemorrhagic', 'perdarahan',
                            'ebola', 'pneumonia akut', 'acute pneumonia'];
      if (urgentKeywords.some(keyword => combinedText.includes(keyword))) {
        return 'URGENT';
      }
      
      // HIGH keywords
      const highKeywords = ['severe', 'hepatitis', 'pneumonia', 'pneumonitis', 'pancreatitis', 'carditis',
                           'myocarditis', 'aspergillosis', 'abscess', 'abses', 'akut', 'acute'];
      if (highKeywords.some(keyword => combinedText.includes(keyword))) {
        return 'HIGH';
      }
      
      // MODERATE keywords
      const moderateKeywords = ['fever', 'demam', 'enteritis', 'gastroenteritis', 'infection', 'infeksi',
                               'dysentery', 'colitis', 'bronchus', 'bronkus', 'cough', 'batuk', 'diarrhea', 'diare'];
      if (moderateKeywords.some(keyword => combinedText.includes(keyword))) {
        return 'MODERATE';
      }
      
      return 'LOW';
    };

    // Format results with triage level
    const recommendations = result.rows.map((row) => ({
      code: row.kode,
      nameId: row.nama,
      nameEn: '-',
      triageLevel: assignTriageLevel(row.nama, '-', row.kode),
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
    const client = getDbClient();
    try {
      await client.connect();
      const result = await client.query(
        `SELECT p.id, p.nama, p.usia, p.tanggal_lahir, p.jenis_kelamin, m.nomor_rekam_medis
         FROM pasien p
         LEFT JOIN medis_pasien m ON p.id = m.id_pasien
         WHERE p.nama ILIKE $1 OR m.nomor_rekam_medis ILIKE $1
         LIMIT 10`,
        [`%${input.query}%`]
      );
      console.log('🔧 searchPatient executed:', { count: result.rows.length });
      return {
        success: true,
        patients: result.rows,
        count: result.rows.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to search patients',
      };
    } finally {
      await client.end();
    }
  },
});

// ============ TOOL 2: Get Patient Health Summary ============
export const getPatientHealthSummaryTool = createTool({
  name: 'getPatientHealthSummary',
  description: 'Get complete health profile and medical data for a specific patient',
  parameters: z.object({
    patientId: z.string().uuid().describe('Patient ID (UUID)'),
  }),
  execute: async (input: { patientId: string }) => {
    const client = getDbClient();
    try {
      await client.connect();

      const patientResult = await client.query(
        `SELECT id, nama, usia, tanggal_lahir, jenis_kelamin, created_at FROM pasien WHERE id = $1`,
        [input.patientId]
      );

      if (patientResult.rows.length === 0) {
        return { success: false, error: 'Patient not found' };
      }

      const patient = patientResult.rows[0];

      const medisResult = await client.query(
        `SELECT id_pasien, nomor_rekam_medis, berat_badan, tinggi_badan, 
                gol_darah, alergi, riwayat_penyakit, diperbarui_pada 
         FROM medis_pasien WHERE id_pasien = $1`,
        [input.patientId]
      );

      const medis = medisResult.rows[0] || {};

      let bmi = null;
      if (medis.berat_badan && medis.tinggi_badan) {
        const heightM = Number(medis.tinggi_badan) / 100;
        bmi = (Number(medis.berat_badan) / (heightM * heightM)).toFixed(1);
      }

      console.log('🔧 getPatientHealthSummary executed:', { nama: patient.nama });
      
      return {
        success: true,
        patient: {
          ...patient,
          ...medis,
          bmi,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get patient health summary',
      };
    } finally {
      await client.end();
    }
  },
});

// ============ TOOL 3: Monitor Patient Status ============
export const monitorPatientStatusTool = createTool({
  name: 'monitorPatientStatus',
  description: 'Get real-time patient status including vital signs and conditions',
  parameters: z.object({
    patientId: z.string().uuid().describe('Patient ID'),
  }),
  execute: async (input: { patientId: string }) => {
    const client = getDbClient();
    try {
      await client.connect();

      const result = await client.query(
        `SELECT p.nama, p.usia, m.berat_badan, m.tinggi_badan, 
                m.gol_darah, m.alergi, m.riwayat_penyakit,
                EXTRACT(YEAR FROM AGE(p.tanggal_lahir)) as age,
                m.diperbarui_pada
         FROM pasien p
         LEFT JOIN medis_pasien m ON p.id = m.id_pasien
         WHERE p.id = $1`,
        [input.patientId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Patient not found' };
      }

      console.log('🔧 monitorPatientStatus executed');
      
      return {
        success: true,
        status: result.rows[0],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to monitor patient status',
      };
    } finally {
      await client.end();
    }
  },
});

// ============ TOOL 4: Update Patient Condition ============
export const updatePatientConditionTool = createTool({
  name: 'updatePatientCondition',
  description: 'Update patient medical condition data',
  parameters: z.object({
    patientId: z.string().uuid().describe('Patient ID'),
    field: z.enum(['berat_badan', 'tinggi_badan', 'gol_darah', 'alergi', 'riwayat_penyakit'])
      .describe('Field to update'),
    value: z.string().describe('New value'),
  }),
  execute: async (input: { patientId: string; field: string; value: string }) => {
    const client = getDbClient();
    try {
      await client.connect();

      const query = `UPDATE medis_pasien SET ${input.field} = $1, diperbarui_pada = NOW() 
                     WHERE id_pasien = $2 RETURNING *`;
      
      const result = await client.query(query, [input.value, input.patientId]);

      if (result.rows.length === 0) {
        return { success: false, error: 'Patient not found' };
      }

      console.log('🔧 updatePatientCondition executed:', { field: input.field });
      
      return {
        success: true,
        updated: result.rows[0],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update patient condition',
      };
    } finally {
      await client.end();
    }
  },
});

// ============ TOOL 5: Get Patient Allergies ============
export const getPatientAllergiesTool = createTool({
  name: 'getPatientAllergies',
  description: 'Get patient allergies with warnings',
  parameters: z.object({
    patientId: z.string().uuid().describe('Patient ID'),
  }),
  execute: async (input: { patientId: string }) => {
    const client = getDbClient();
    try {
      await client.connect();

      const result = await client.query(
        `SELECT p.nama, m.alergi FROM pasien p
         LEFT JOIN medis_pasien m ON p.id = m.id_pasien
         WHERE p.id = $1`,
        [input.patientId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Patient not found' };
      }

      console.log('🔧 getPatientAllergies executed');
      
      return {
        success: true,
        allergies: result.rows[0],
        warning: result.rows[0].alergi ? '⚠️ Patient has allergies' : 'No known allergies',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get patient allergies',
      };
    } finally {
      await client.end();
    }
  },
});

// ============ TOOL 6: Get Patient Medical History ============
export const getPatientMedicalHistoryTool = createTool({
  name: 'getPatientMedicalHistory',
  description: 'Get patient medical history and blood type',
  parameters: z.object({
    patientId: z.string().uuid().describe('Patient ID'),
  }),
  execute: async (input: { patientId: string }) => {
    const client = getDbClient();
    try {
      await client.connect();

      const result = await client.query(
        `SELECT p.nama, m.riwayat_penyakit, m.gol_darah FROM pasien p
         LEFT JOIN medis_pasien m ON p.id = m.id_pasien
         WHERE p.id = $1`,
        [input.patientId]
      );

      if (result.rows.length === 0) {
        return { success: false, error: 'Patient not found' };
      }

      console.log('🔧 getPatientMedicalHistory executed');
      
      return {
        success: true,
        history: result.rows[0],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get patient medical history',
      };
    } finally {
      await client.end();
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

// ============ EXPORT ALL TOOLS AS ARRAY ============
export const agentTools = [
  searchPatientTool,
  getPatientHealthSummaryTool,
  monitorPatientStatusTool,
  updatePatientConditionTool,
  getPatientAllergiesTool,
  getPatientMedicalHistoryTool,
  searchDiagnosaWithTriageTool,
];
