import { Agent } from "@voltagent/core";

import { getGeneralGuidanceLlmConfig, getGeneralGuidanceModel } from "@/lib/agents/llm-router";

type AgentGenerationResult = {
  text: string | Promise<string>;
};

const ACTION_REQUEST_PATTERNS = [
  /\btindakan\b/i,
  /\bapa yang harus\b/i,
  /\blangkah awal\b/i,
  /\bobservasi\b/i,
  /\bedukasi\b/i,
];

function isConciseActionRequest(message: string) {
  return ACTION_REQUEST_PATTERNS.some((pattern) => pattern.test(message));
}

function buildUserPrompt(userMessage: string) {
  const normalized = userMessage.trim();

  if (!isConciseActionRequest(normalized)) {
    return normalized;
  }

  return [
    normalized,
    '',
    'Instruksi format jawaban: jawab singkat dan langsung pakai format berikut.',
    'Maksimal 7 baris isi, tanpa paragraf panjang, tanpa summary atau assessment panjang.',
    'Format wajib:',
    'Triage',
    '- ...',
    'Tindakan',
    '- ...',
    'Monitoring',
    '- ...',
    'Eskalasi',
    '- ...',
  ].join('\n');
}
type NurseChatHistoryMessage = {
  role: "user" | "assistant";
  message: string;
};


function buildSafeGeneralFallback(userMessage: string) {
  const normalized = userMessage.toLowerCase();

  if (/\b(mual|muntah)\b/.test(normalized)) {
    return [
      "Triage",
      "- Cek kesadaran, tekanan darah, nadi, suhu, frekuensi napas, dan tanda dehidrasi.",
      "Tindakan",
      "- Istirahatkan pasien, berikan cairan sedikit tetapi sering bila sadar dan tidak ada kontraindikasi.",
      "Monitoring",
      "- Pantau frekuensi muntah, intake-output, nyeri perut, demam, dan tanda lemas berat.",
      "Eskalasi",
      "- Segera hubungi dokter/IGD bila muntah terus-menerus, darah, penurunan kesadaran, dehidrasi berat, nyeri perut hebat, atau hamil/anak/lansia berisiko.",
      "",
      "Catatan: MedGemma sedang timeout, jadi ini fallback panduan umum aman. Keputusan klinis tetap mengikuti evaluasi dokter dan kondisi pasien saat ini.",
    ].join("\n");
  }

  if (/\b(sesak|napas|nafas)\b/.test(normalized)) {
    return [
      "Triage",
      "- Cek SpO2, frekuensi napas, nadi, tekanan darah, suhu, kesadaran, dan tanda sianosis.",
      "Tindakan",
      "- Posisikan semi-Fowler, longgarkan pakaian, dan siapkan oksigen sesuai instruksi/protokol fasilitas.",
      "Monitoring",
      "- Pantau SpO2, pola napas, penggunaan otot bantu napas, dan respons pasien.",
      "Eskalasi",
      "- Segera eskalasi bila SpO2 rendah, sesak berat, nyeri dada, penurunan kesadaran, atau kondisi memburuk.",
      "",
      "Catatan: MedGemma sedang timeout, jadi ini fallback panduan umum aman. Keputusan klinis tetap mengikuti evaluasi dokter dan kondisi pasien saat ini.",
    ].join("\n");
  }

  if (/\b(demam|batuk)\b/.test(normalized)) {
    return [
      "Triage",
      "- Cek suhu, nadi, frekuensi napas, SpO2, dan kondisi umum pasien.",
      "Tindakan",
      "- Anjurkan istirahat, cairan cukup bila tidak kontraindikasi, dan observasi gejala penyerta.",
      "Monitoring",
      "- Pantau suhu berkala, sesak, nyeri dada, penurunan intake, dan tanda dehidrasi.",
      "Eskalasi",
      "- Hubungi dokter bila demam tinggi menetap, sesak, SpO2 turun, lemas berat, atau ada komorbid/risiko tinggi.",
      "",
      "Catatan: MedGemma sedang timeout, jadi ini fallback panduan umum aman. Keputusan klinis tetap mengikuti evaluasi dokter dan kondisi pasien saat ini.",
    ].join("\n");
  }

  return [
    "Triage",
    "- Cek tanda vital, kesadaran, keluhan utama, durasi gejala, dan faktor risiko pasien.",
    "Tindakan",
    "- Lakukan observasi awal sesuai protokol fasilitas dan dokumentasikan temuan penting.",
    "Monitoring",
    "- Pantau perubahan gejala, tanda vital, nyeri, intake-output, dan respons terhadap tindakan awal.",
    "Eskalasi",
    "- Hubungi dokter/IGD bila ada penurunan kesadaran, sesak, nyeri dada, perdarahan, dehidrasi berat, atau kondisi memburuk.",
    "",
    "Catatan: MedGemma sedang timeout, jadi ini fallback panduan umum aman. Keputusan klinis tetap mengikuti evaluasi dokter dan kondisi pasien saat ini.",
  ].join("\n");
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  promise.catch(() => undefined);

  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timeout after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

function buildConversationMessages(
  userMessage: string,
  history: NurseChatHistoryMessage[] = []
) {
  const normalizedUserMessage = buildUserPrompt(userMessage);
  const conversation = history
    .filter(
      (entry) =>
        (entry.role === "user" || entry.role === "assistant") &&
        typeof entry.message === "string" &&
        entry.message.trim().length > 0
    )
    .slice(-8)
    .map((entry) => ({
      role: entry.role,
      content: entry.message.trim(),
    }));

  const lastEntry = conversation.at(-1);
  if (lastEntry?.role === "user" && lastEntry.content === normalizedUserMessage) {
    return conversation;
  }

  return [
    ...conversation,
    {
      role: "user" as const,
      content: normalizedUserMessage,
    },
  ];
}

let generalGuidanceAgentInstance: Agent | null = null;

async function initializeGeneralGuidanceAgent() {
  if (generalGuidanceAgentInstance) {
    return generalGuidanceAgentInstance;
  }

  const llmConfig = getGeneralGuidanceLlmConfig();

  generalGuidanceAgentInstance = new Agent({
    name: "DARSI General Guidance Agent",
    instructions: `Anda adalah chatbot umum untuk perawat yang menjawab dengan nada membantu, hangat, tenang, dan profesional.

Fokus Anda:
- penanganan umum pasien
- observasi awal yang perlu dipantau
- edukasi singkat untuk pasien/keluarga
- rekomendasi tindakan umum yang bersifat naratif

Gaya jawaban:
- Gunakan Bahasa Indonesia yang hangat dan suportif tanpa terdengar berlebihan.
- Jawab dengan struktur yang jelas dan mudah dipakai di lapangan.
- Utamakan jawaban singkat berbentuk list atau blok pendek, bukan paragraf panjang.
- Gunakan markdown rapi bila membantu, misalnya **bold** untuk poin penting, *italic* untuk penekanan ringan, dan list untuk langkah atau observasi.
- Untuk pertanyaan tindakan, observasi, edukasi, atau langkah awal, jawaban harus ringkas dan langsung ke aksi.
- Untuk pertanyaan tindakan, gunakan format sesingkat mungkin seperti: Triage, Tindakan, Monitoring, Eskalasi.
- Hindari paragraf panjang jika poin singkat lebih jelas.
- Jika user tampak bingung, jawab dengan nada membimbing dan tidak menghakimi.

Aturan:
- Jangan mengarang data sistem rumah sakit.
- Jangan menulis atau mengubah clinical notes, SOAP, atau data database.
- Jangan menyatakan kepastian diagnosis bila data klinis tidak cukup.
- Berikan jawaban yang klinis, aman, dan praktis untuk perawat.
- Perhatikan konteks percakapan sebelumnya dalam session yang sama. Jika user memberi pertanyaan lanjutan, sambungkan jawaban dengan kondisi atau topik yang sudah dibahas sebelumnya.
- Jika user menanyakan kode ICD secara umum, Anda boleh memberikan referensi ICD-10 yang paling mungkin untuk gejala atau kondisi yang ditanyakan.
- Untuk pertanyaan ICD umum, jangan menolak otomatis. Jawab dengan format singkat seperti:
  - Referensi ICD-10 yang mungkin
  - Kapan kode itu biasa dipakai
  - Catatan bahwa penetapan final tetap mengikuti evaluasi klinis/dokter
- Jangan mengarang kode. Jika ragu, nyatakan bahwa kodenya perlu konfirmasi klinis, tetapi tetap berikan kandidat yang paling relevan bila Anda mengetahuinya.
- Jika kondisi tampak gawat, arahkan untuk segera eskalasi ke dokter/IGD.
- Untuk rekomendasi umum, beri pengingat singkat bahwa keputusan klinis final tetap mengikuti evaluasi dokter dan kondisi pasien saat ini.
`,
    model: getGeneralGuidanceModel(),
    markdown: true,
    maxSteps: 4,
    temperature: 0.2,
  });

  console.log("✅ General guidance agent initialized");
  console.log("🤖 General model:", llmConfig.model);
  return generalGuidanceAgentInstance;
}

export async function generalGuidanceChat(
  userMessage: string,
  history: NurseChatHistoryMessage[] = []
) {
  const agent = await initializeGeneralGuidanceAgent();

  try {
    const result = (await withTimeout(
      agent.generateText(
        buildConversationMessages(userMessage, history),
        {
          maxOutputTokens: isConciseActionRequest(userMessage) ? 320 : 1000,
          maxSteps: 4,
          temperature: 0.2,
          timeout: 20000,
        }
      ) as Promise<AgentGenerationResult>,
      20000,
      "General guidance agent"
    )) as AgentGenerationResult;

    const text = await result.text;

    return {
      success: true,
      message: text,
      toolsUsed: [] as string[],
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("General guidance agent failed, using fallback:", error);

    return {
      success: true,
      message: buildSafeGeneralFallback(userMessage),
      toolsUsed: [] as string[],
      timestamp: new Date().toISOString(),
    };
  }
}

export async function getGeneralGuidanceAgentStatus() {
  const llmConfig = getGeneralGuidanceLlmConfig();
  return {
    status: "ready",
    model: llmConfig.model,
    provider: llmConfig.provider,
    baseUrl: llmConfig.baseUrl,
    toolsCount: 0,
  };
}
