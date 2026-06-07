import { Agent } from "@voltagent/core";

import { getGeneralGuidanceLlmConfig, getGeneralGuidanceModel } from "@/lib/llm-router";

type AgentGenerationResult = {
  text: string | Promise<string>;
};

type NurseChatHistoryMessage = {
  role: "user" | "assistant";
  message: string;
};

function buildConversationMessages(
  userMessage: string,
  history: NurseChatHistoryMessage[] = []
) {
  const normalizedUserMessage = userMessage.trim();
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
- Gunakan markdown rapi bila membantu, misalnya **bold** untuk poin penting, *italic* untuk penekanan ringan, dan list untuk langkah atau observasi.
- Bila cocok, gunakan format singkat seperti:
  - Kondisi umum
  - Yang perlu dipantau
  - Langkah awal
  - Kapan eskalasi
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

  const result = (await agent.generateText(
    buildConversationMessages(userMessage, history),
    {
      maxOutputTokens: 1000,
      maxSteps: 4,
      temperature: 0.2,
    }
  )) as AgentGenerationResult;

  const text = await result.text;

  return {
    success: true,
    message: text,
    toolsUsed: [] as string[],
    timestamp: new Date().toISOString(),
  };
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
