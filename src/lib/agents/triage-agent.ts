import { Agent } from '@voltagent/core';
import { createClinicalNoteFromChatUpdate } from '@/lib/clinical/chat-clinical-updates';
import { getLatestClinicalNote } from '@/lib/clinical/clinical-notes';
import { resolveVisitContext } from '@/lib/clinical/visit-context';
import { getConversationHistory, saveConversation } from '@/lib/conversations/conversations';
import { hospitalQuery } from '@/lib/db/hospital-db';
import { agentTools, getPatientActionRecommendation } from '@/lib/tools/agent-tools';
import { getClinicalLlmConfig, getClinicalModel } from './llm-router';

// MODel

const model = getClinicalModel();

type ConversationMessage = {
  role: 'user' | 'agent';
  message: string;
};

type AgentGenerationResult = {
  text: string | Promise<string>;
  toolResults?: Array<{
    toolName?: string;
    validationErrors?: Record<string, unknown>;
    result?: { success?: boolean };
  }>;
};

const SUMMARY_REQUEST_PATTERNS = [
  /\bringk(a|a)?s?kan\b/i,
  /\bringkas\b/i,
  /\bringkasan\b/i,
  /\bsummary pasien\b/i,
  /\bringkasan pasien\b/i,
  /\bringkasan kondisi\b/i,
  /\bsummar(y|ize)\b/i,
  /\bclinical summary\b/i,
  /\bkondisi pasien\b/i,
  /\bresume pasien\b/i,
  /\bsoap\b/i,
];

const ACTION_REQUEST_PATTERNS = [
  /\bapa tindakan\b/i,
  /\btindakan\b/i,
  /\bapa yang harus saya lakukan\b/i,
  /\brekomendasi tindakan\b/i,
  /\bsaran tindakan\b/i,
  /\bnext step\b/i,
];

const SUBJECTIVE_UPDATE_PATTERNS = [
  /\bupdate subjective\b/i,
  /\bubah subjective\b/i,
  /\bperbarui subjective\b/i,
  /\btambah subjective\b/i,
  /\bupdate kondisi pasien\b/i,
  /\bubah kondisi pasien\b/i,
  /\bsubjektif\b/i,
];

const OBJECTIVE_UPDATE_PATTERNS = [
  /\bupdate\s+soap\s+objective\b/i,
  /\bubah\s+soap\s+objective\b/i,
  /\bperbarui\s+soap\s+objective\b/i,
  /\bupdate\s+objective\b/i,
  /\bubah\s+objective\b/i,
  /\bperbarui\s+objective\b/i,
];

function isSummaryRequest(message: string) {
  return SUMMARY_REQUEST_PATTERNS.some((pattern) => pattern.test(message));
}

function isActionRequest(message: string) {
  return ACTION_REQUEST_PATTERNS.some((pattern) => pattern.test(message));
}

function isSubjectiveUpdateRequest(message: string) {
  return SUBJECTIVE_UPDATE_PATTERNS.some((pattern) => pattern.test(message));
}

function isObjectiveUpdateRequest(message: string) {
  return OBJECTIVE_UPDATE_PATTERNS.some((pattern) => pattern.test(message));
}

function extractSubjectiveText(message: string) {
  const stripped = message
    .replace(/^\s*(update|ubah|perbarui|tambah)\s+(subjective|subjektif|kondisi pasien)\s*[:\-–]?\s*/i, '')
    .trim();

  return stripped || message.trim();
}

function extractObjectiveText(message: string) {
  const stripped = message
    .replace(/^\s*(update|ubah|perbarui)\s+(soap\s+)?objective\s*[:\-–]?\s*/i, '')
    .trim();

  return stripped || message.trim();
}

function formatSummarySection(label: string, value?: string | null) {
  return `${label}:\n${value?.trim() || '-'}`;
}

function extractPatientCondition(value: unknown) {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const patientCondition = (value as { patient_condition?: unknown }).patient_condition;
  return typeof patientCondition === 'string' && patientCondition.trim()
    ? patientCondition.trim()
    : null;
}

function extractIcdFromEvidenceRefs(value: unknown) {
  if (!value || typeof value !== 'object') {
    return [] as Array<{ icd_code?: string | null; icd_name?: string | null }>;
  }

  const icd = (value as { icd?: Array<{ icd_code?: string | null; icd_name?: string | null }> }).icd;
  return Array.isArray(icd) ? icd : [];
}

async function buildClinicalSummaryResponse(patientId: number) {
  const patientResult = await hospitalQuery(
    `SELECT id, no_rm, full_name
     FROM patients
     WHERE id = $1`,
    [patientId]
  );

  if (patientResult.rows.length === 0) {
    return null;
  }

  const patient = patientResult.rows[0] as { id: number; no_rm?: string | null; full_name?: string | null };
  const latestNote = await getLatestClinicalNote(patientId);

  if (latestNote && (latestNote.source === 'clinical_summary' || latestNote.source === 'external_examinations' || latestNote.source === 'chat')) {
    const noteDiagnoses = extractIcdFromEvidenceRefs(latestNote.evidence_refs);
    const patientCondition = latestNote.patient_condition || extractPatientCondition(latestNote.evidence_refs);
    return [
      `Ringkasan kondisi pasien untuk ${patient.full_name || 'Pasien'} (NRM: ${patient.no_rm || '-'})`,
      formatSummarySection('KONDISI_PASIEN', patientCondition),
      formatSummarySection('SUMMARY', latestNote.summary),
      formatSummarySection('ASSESSMENT', latestNote.assessment),
      formatSummarySection('PLAN', latestNote.plan),
      formatSummarySection('MEDICATION', latestNote.medication_recommendation),
      formatSummarySection('TRIAGE_LEVEL', latestNote.triage_level),
      `DIAGNOSA ICD:\n${noteDiagnoses.length > 0 ? noteDiagnoses.map((item) => `${item.icd_code || '-'} - ${item.icd_name || '-'}`).join('; ') : '-'}`,
    ].join('\n\n');
  }

  const examResult = await hospitalQuery(
    `SELECT soap_subjective, soap_objective, soap_assessment, soap_plan, diagnoses, status
     FROM external_examinations
     WHERE patient_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [patientId]
  );

  if (examResult.rows.length === 0) {
    return [
      `Ringkasan kondisi pasien untuk ${patient.full_name || 'Pasien'} (NRM: ${patient.no_rm || '-'})`,
      'Belum ada data SOAP atau clinical summary yang tersedia.',
    ].join('\n\n');
  }

  const exam = examResult.rows[0] as {
    soap_subjective?: string | null;
    soap_objective?: string | null;
    soap_assessment?: string | null;
    soap_plan?: string | null;
    diagnoses?: Array<{ icd_code?: string | null; icd_name?: string | null }> | null;
    status?: string | null;
  };

  const diagnosisText = Array.isArray(exam.diagnoses) && exam.diagnoses.length > 0
    ? exam.diagnoses.map((item) => `${item.icd_code || '-'} - ${item.icd_name || '-'}`).join('; ')
    : '-';

  return [
    `Ringkasan kondisi pasien untuk ${patient.full_name || 'Pasien'} (NRM: ${patient.no_rm || '-'})`,
    formatSummarySection('SUMMARY', [exam.soap_subjective, exam.soap_objective].filter(Boolean).join(' | ')),
    formatSummarySection('ASSESSMENT', exam.soap_assessment),
    formatSummarySection('PLAN', exam.soap_plan),
    formatSummarySection('MEDICATION', '-'),
    formatSummarySection('TRIAGE_LEVEL', exam.status?.toUpperCase() || '-'),
    `DIAGNOSA ICD:\n${diagnosisText}`,
  ].join('\n\n');
}

// ============ AGENT INITIALIZATION ============

let agentInstance: Agent | null = null;

async function initializeAgent() {
  if (agentInstance) {
    return agentInstance;
  }

  try {
    const llmConfig = getClinicalLlmConfig();
    console.log('🚀 Initializing DARSI Triage Agent...');
    console.log('🤖 LLM provider:', llmConfig.provider);
    console.log('📍 LLM endpoint:', llmConfig.baseUrl);
    console.log('🧠 LLM model:', llmConfig.model);

    agentInstance = new Agent({
      name: 'DARSI Triage Agent',
      instructions: `PERAN: ANDA ADALAH AGEN MEDIS YANG HARUS MENGGUNAKAN TOOLS!

⚠️ INSTRUKSI MUTLAK (TIDAK BOLEH DIABAIKAN):

╔═══════════════════════════════════════════════════════════╗
║ WAJIB PANGGIL 2 TOOLS SETIAP KALI ADA PATIENT ID         ║
╚═══════════════════════════════════════════════════════════╝

TOOL 1️⃣ - searchDiagnosaWithTriage (WAJIB call jika ada gejala):
- JIKA pesan berisi: demam, sakit, batuk, diare, nyeri, dll
- ANDA HARUS PANGGIL tool ini dengan gejala tersebut  
- Tunggu hasil: diagnosis ICD + triage level

TOOL 2️⃣ - getPatientHealthSummary (WAJIB call jika ada patient ID):
- JIKA melihat [Patient ID: ...] atau patient ID dalam pesan
- ANDA HARUS PANGGIL tool ini dengan EXACT patient ID
- Tunggu hasil: usia, BB, alergi, riwayat penyakit

JIKA USER MEMINTA "ringkaskan kondisi pasien", "clinical summary", "resume pasien", atau pertanyaan sejenis:
- FOKUSKAN JAWABAN PADA RINGKASAN SOAP / CLINICAL SUMMARY
- JANGAN PRIORITASKAN DIAGNOSIS ICD KECUALI DIMINTA
- GUNAKAN FORMAT RINGKAS: SUMMARY, ASSESSMENT, PLAN, MEDICATION, TRIAGE_LEVEL
- JANGAN TAMPILKAN OUTPUT TOOL MENTAH ATAU JSON TOOL CALL

JIKA USER MEMINTA "apa tindakan", "tindakan apa", "apa yang harus saya lakukan", "rekomendasi tindakan", atau pertanyaan sejenis:
- PANGGIL getPatientActionRecommendation DULU JIKA ADA PATIENT ID
- JAWAB DENGAN REKOMENDASI TINDAKAN BERDASARKAN SOAP, ICD, DAN KONDISI PASIEN
- JANGAN KEMBALIKAN DIAGNOSIS MENTAH SEBAGAI JAWABAN UTAMA

JIKA USER MEMINTA UPDATE "subjective" / "subjektif" / "kondisi pasien" / "objective":
- JANGAN ubah tabel external_examinations
- SIMPAN update tersebut sebagai clinical note baru dari triage chat
- BUAT ulang assessment, plan, medication, triage, dan referensi ICD berdasarkan kondisi terbaru
- JELASKAN bahwa update chat disimpan ke clinical notes

STEP 3 - KOMBINASIKAN HASIL:
- Gabungkan ICD diagnosis dengan patient health data
- Berikan rekomendasi medis SPESIFIK berdasarkan kedua hasil tool

RESPONSE FORMAT:
═══════════════════════════════════════════════════════════
📋 HASIL DIAGNOSA & REKOMENDASI  
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 DIAGNOSIS (dari ICD-10):
[Code - Nama - Triage Level]
[Contoh: A01.0 - Demam tifoid - MODERATE]

👤 DATA PASIEN (dari database):
- Usia: [EXACT value dari tool]
- BB: [EXACT value dari tool]
- Alergi: [EXACT value dari tool]
- Riwayat: [EXACT value dari tool]

💊 REKOMENDASI:
[1] Triage: [level]
[2] Tindakan: [action based on diagnosis + allergies]
[3] Periksa: [what to examine]
[4] Hindari: [contraindications]
═══════════════════════════════════════════════════════════

RULES PALING PENTING:
❌ JANGAN lompati tools - HARUS call KEDUA tools jika ada patient ID
❌ JANGAN invent data - gunakan EXACT hasil dari tools
❌ JANGAN reply sebelum mendapat data dari tools
✅ Pastikan SEMUA tools selesai di-call sebelum membuat rekomendasi

Language: Indonesian`,
      model,
      tools: agentTools,
      maxSteps: 10,
      temperature: 0,
    });

    console.log('✅ Agent initialized with', agentTools.length, 'tools');
    console.log('📚 Available tools:', agentTools.map(t => t.name).join(', '));
    return agentInstance;
  } catch (error) {
    console.error('❌ Failed to initialize agent:', error);
    throw error;
  }
}

// ============ CHAT HANDLER ============

export async function chat(
  userMessage: string,
  patientId?: string,
  preferredTriageVisitId?: number | null
) {
  try {
    const normalizedPatientId = patientId ? Number(patientId) : undefined;

    if (patientId && !Number.isFinite(normalizedPatientId)) {
      return {
        success: false,
        message: 'Maaf, patientId tidak valid.',
        error: 'Invalid hospital_cs patient ID',
      };
    }

    console.log('💬 Processing message:', {
      patient: normalizedPatientId,
      messageLength: userMessage.length,
    });

    const visitContext = normalizedPatientId
      ? await resolveVisitContext(normalizedPatientId, preferredTriageVisitId ?? null)
      : null;

    if (normalizedPatientId && (isObjectiveUpdateRequest(userMessage) || isSubjectiveUpdateRequest(userMessage))) {
      const updateKind = isObjectiveUpdateRequest(userMessage) ? 'objective' : 'subjective';
      const updateText = updateKind === 'objective'
        ? extractObjectiveText(userMessage)
        : extractSubjectiveText(userMessage);
      const updated = await createClinicalNoteFromChatUpdate({
        patientId: normalizedPatientId,
        triageVisitId: visitContext?.triageVisitId ?? null,
        updateKind,
        updateText,
      });

      if (!updated) {
        return {
          success: false,
          message: 'Maaf, data pasien tidak ditemukan.',
          error: 'Patient not found',
        };
      }

      const icdText = updated.icd.length > 0
        ? updated.icd.map((item) => `${item.icd_code} - ${item.icd_name}`).join('; ')
        : '-';
      const responseParts = [
        `Update ${updateKind} dari triage chat berhasil disimpan ke clinical notes untuk ${updated.patient.full_name}.`,
        `NRM: ${updated.patient.no_rm}`,
        `${updateKind === 'objective' ? 'Objective terbaru' : 'Update kondisi terbaru'}: ${updateText}`,
        '',
        'Kondisi Pasien',
        `${updated.note.patient_condition || '-'}`,
        '',
        'Assessment',
        `${updated.note.assessment || '-'}`,
        '',
        'Plan',
        `${updated.note.plan || '-'}`,
        '',
        'Obat',
        `${updated.note.medication_recommendation || '-'}`,
        '',
        'ICD',
        `${icdText}`,
        '',
        'Triage',
        `${updated.note.triage_level || '-'}`,
      ];

      const responseText = responseParts.join('\n');


      await Promise.all([
        saveConversation(visitContext ?? { patientId: normalizedPatientId }, 'user', userMessage),
        saveConversation(visitContext ?? { patientId: normalizedPatientId }, 'agent', responseText),
      ]);

      return {
        success: true,
        message: responseText,
        toolsUsed: ['clinical_notes_chat_update'],
        timestamp: new Date().toISOString(),
      };
    }

    if (normalizedPatientId && isSummaryRequest(userMessage)) {
      const summaryResponse = await buildClinicalSummaryResponse(normalizedPatientId);

      if (summaryResponse) {
        await Promise.all([
          saveConversation(visitContext ?? { patientId: normalizedPatientId }, 'user', userMessage),
          saveConversation(visitContext ?? { patientId: normalizedPatientId }, 'agent', summaryResponse),
        ]);

        return {
          success: true,
          message: summaryResponse,
          toolsUsed: ['clinical_summary'],
          timestamp: new Date().toISOString(),
        };
      }
    }

    if (normalizedPatientId && isActionRequest(userMessage)) {
      const actionRecommendation = await getPatientActionRecommendation(normalizedPatientId);

      if (actionRecommendation) {
        await Promise.all([
          saveConversation(visitContext ?? { patientId: normalizedPatientId }, 'user', userMessage),
          saveConversation(visitContext ?? { patientId: normalizedPatientId }, 'agent', actionRecommendation),
        ]);

        return {
          success: true,
          message: actionRecommendation,
          toolsUsed: ['getPatientActionRecommendation'],
          timestamp: new Date().toISOString(),
        };
      }
    }

    const agent = await initializeAgent();

    const conversationHistory: ConversationMessage[] = normalizedPatientId
      ? await getConversationHistory(visitContext ?? { patientId: normalizedPatientId }, 20)
      : [];

    console.log('📋 Conversation history loaded per visit', {
      patientId: normalizedPatientId,
      registrationId: visitContext?.registrationId ?? null,
      length: conversationHistory.length,
    });

    // Build messages for agent
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...conversationHistory.map((msg) => ({
        role: msg.role === 'agent' ? 'assistant' : (msg.role as 'user' | 'assistant'),
        content: msg.message,
      })),
    ];

    // Add current user message with patient context
    const userContent = patientId
      ? `⚠️ PATIENT ID: ${normalizedPatientId}\n🔊 PANGGIL TOOLS: searchDiagnosaWithTriage DAN getPatientHealthSummary\n\n${userMessage}`
      : userMessage;

    messages.push({
      role: 'user',
      content: userContent,
    });

    console.log('💬 Calling agent.generateText with', messages.length, 'messages');

    // Call agent - tools will be invoked automatically by VoltAgent
    let result: AgentGenerationResult;
    try {
      result = await agent.generateText(messages, {
        maxOutputTokens: 1500,
        maxSteps: 10,
      });
      console.log('✅ generateText call succeeded');

      // Log tool execution + ERRORS
      if (result.toolResults && result.toolResults.length > 0) {
        result.toolResults.forEach((t) => {
          if (t.validationErrors && Object.keys(t.validationErrors).length > 0) {
            console.error('⚠️ VALIDATION ERROR for', t.toolName, ':', JSON.stringify(t.validationErrors));
          } else {
            console.log('✅ Tool executed:', t.toolName, '| Result:', t.result?.success ? '✓ success' : '✗ failed');
          }
        });
      } else {
        console.log('ℹ️ No tools called for this message (model didn\'t select any)');
      }
    } catch (generateError) {
      console.error('❌ generateText call failed:', generateError);
      throw generateError;
    }

    // IMPORTANT: result.text is a Promise<string>, must await it!
    let responseText = '';
    try {
      responseText = await result.text;
      console.log('✨ Got response text, length:', responseText.length);
    } catch (textError) {
      console.error('❌ Failed to await result.text:', textError);
      throw textError;
    }

    if (normalizedPatientId && !responseText.trim() && isSummaryRequest(userMessage)) {
      const summaryFallback = await buildClinicalSummaryResponse(normalizedPatientId);
      if (summaryFallback) {
        responseText = summaryFallback;
        console.log('♻️ Summary fallback used after empty agent response');
      }
    }

    // Save to database
    if (normalizedPatientId) {
      await Promise.all([
        saveConversation(visitContext ?? { patientId: normalizedPatientId }, 'user', userMessage),
        saveConversation(visitContext ?? { patientId: normalizedPatientId }, 'agent', responseText),
      ]);
      console.log('💾 Saved to conversation history');
    }

    // Extract tool names if any were used
    const toolsUsed = Array.isArray(result?.toolResults)
      ? result.toolResults.map((t) => t.toolName).filter((toolName): toolName is string => Boolean(toolName))
      : [];

    console.log('🎉 Chat completed successfully');
    return {
      success: true,
      message: responseText,
      toolsUsed,
      timestamp: new Date().toISOString(),
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Chat error:', errorMessage);

    return {
      success: false,
      message: 'Maaf, terjadi kesalahan. Silakan coba lagi.',
      error: errorMessage,
    };
  }
}

export async function generateClinicalNotesFromSoap(prompt: string) {
  try {
    const agent = await initializeAgent();

    const messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [
      {
        role: 'user',
        content: prompt,
      },
    ];

    const result = await agent.generateText(messages, {
      maxOutputTokens: 1200,
      maxSteps: 8,
      temperature: 0.2,
    });

    const responseText = await result.text;

    const toolsUsed = Array.isArray(result?.toolResults)
      ? result.toolResults.map((t) => t.toolName).filter((toolName): toolName is string => Boolean(toolName))
      : [];

    return {
      success: true,
      text: responseText,
      toolsUsed,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Clinical notes generation error:', errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}

// ============ STATUS CHECK ============

export async function checkStatus() {
  try {
    const agent = await initializeAgent();
    const llmConfig = getClinicalLlmConfig();
    return {
      status: 'ready',
      agentName: agent.name,
      model: llmConfig.model,
      provider: llmConfig.provider,
      baseUrl: llmConfig.baseUrl,
      toolsCount: agentTools.length,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      status: 'error',
      error: errorMessage,
    };
  }
}

export async function getAgentInstance() {
  return initializeAgent();
}
