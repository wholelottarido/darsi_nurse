import { Agent } from '@voltagent/core';
import { createOllama } from 'ollama-ai-provider-v2';
import { agentTools } from './agent-tools';
import { saveConversation, getConversationHistory } from './conversations';

// ============ OLLAMA MODEL ============

const ollamaInstance = createOllama({
  baseURL: process.env.OLLAMA_HOST || 'http://localhost:11434/api',
});

const model = ollamaInstance('llama3.2');

// ============ AGENT INITIALIZATION ============

let agentInstance: Agent | null = null;

async function initializeAgent() {
  if (agentInstance) {
    return agentInstance;
  }

  try {
    console.log('🚀 Initializing DARSI Triage Agent...');
    console.log('📍 Ollama endpoint:', process.env.OLLAMA_HOST || 'http://localhost:11434/api');

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
  limit: number = 10
) {
  try {
    const agent = await initializeAgent();

    console.log('💬 Processing message:', {
      patient: patientId,
      messageLength: userMessage.length,
    });

    // Get conversation history - DISABLED to ensure tools are called fresh
    // Each request should call tools anew, not rely on cached conversation
    const conversationHistory: any[] = [];
    // const conversationHistory = patientId
    //   ? await getConversationHistory(patientId, limit)
    //   : [];

    console.log('📋 Conversation history: DISABLED (fresh tool calls only)', {
      patientId,
      length: conversationHistory.length,
    });

    // Build messages for agent
    const messages: any[] = [
      ...conversationHistory.map((msg) => ({
        role: msg.role === 'agent' ? 'assistant' : (msg.role as 'user' | 'assistant'),
        content: msg.message,
      })),
    ];

    // Add current user message with patient context
    const userContent = patientId
      ? `⚠️ PATIENT ID: ${patientId}\n🔊 PANGGIL TOOLS: searchDiagnosaWithTriage DAN getPatientHealthSummary\n\n${userMessage}`
      : userMessage;

    messages.push({
      role: 'user',
      content: userContent,
    });

    console.log('💬 Calling agent.generateText with', messages.length, 'messages');

    // Call agent - tools will be invoked automatically by VoltAgent
    let result: any;
    try {
      result = await agent.generateText(messages, {
        maxOutputTokens: 1500,
        maxSteps: 10,
      });
      console.log('✅ generateText call succeeded');

      // Log tool execution + ERRORS
      if (result.toolResults && result.toolResults.length > 0) {
        result.toolResults.forEach((t: any) => {
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

    // Save to database
    if (patientId) {
      await Promise.all([
        saveConversation(patientId, 'user', userMessage),
        saveConversation(patientId, 'agent', responseText),
      ]);
      console.log('💾 Saved to conversation history');
    }

    // Extract tool names if any were used
    const toolsUsed = Array.isArray(result?.toolResults)
      ? result.toolResults.map((t: any) => t.toolName)
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
      ? result.toolResults.map((t: any) => t.toolName)
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
    return {
      status: 'ready',
      agentName: agent.name,
      model: 'llama3.2',
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
