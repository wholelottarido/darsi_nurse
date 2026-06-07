import { generalGuidanceChat, getGeneralGuidanceAgentStatus } from "@/lib/agents/general-agent";
import { getOperationalAgentStatus, operationalChat } from "@/lib/agents/operational-agent";

export type NurseChatIntent = "operational" | "general_guidance" | "hybrid" | "out_of_scope";

export type NurseChatHistoryMessage = {
  role: "user" | "assistant";
  message: string;
};

type NurseChatRouteDecision = {
  intent: NurseChatIntent;
  reason: string;
};

type NurseChatResponse = {
  success: boolean;
  message: string;
  intent: NurseChatIntent;
  delegatedAgents: string[];
  toolsUsed: string[];
  timestamp: string;
};

const OPERATIONAL_PATTERNS = [
  /\b(stok|ketersediaan|tersedia|habis|kosong)\b/,
  /\b(obat|farmasi|medikasi)\b/,
  /\bdaftar pasien\b/,
  /\bpasien (yang )?saya tangani\b/,
  /\bpasien saya\b/,
  /\bsiapa saja pasien\b/,
  /\bringkasan( singkat)? pasien\b/,
  /\bsummary pasien\b/,
  /\bresume pasien\b/,
  /\bno rm\b/,
  /\bnrm\b/,
  /\brm\d+\b/,
];

const GENERAL_GUIDANCE_PATTERNS = [
  /\bpenanganan\b/,
  /\btindakan\b/,
  /\bobservasi\b/,
  /\bedukasi\b/,
  /\blangkah awal\b/,
  /\bapa yang harus dilakukan\b/,
  /\brekomendasi\b/,
  /\bpasien (demam|batuk|sesak|nyeri|mual|muntah|pusing|diare)\b/,
  /\bbagaimana menangani\b/,
];

const MEDICAL_CONTEXT_PATTERNS = [
  /\bpasien\b/,
  /\bmedis\b/,
  /\bklinis\b/,
  /\bperawat\b/,
  /\bdokter\b/,
  /\bigd\b/,
  /\bsoap\b/,
  /\btriage\b/,
  /\bicd\b/,
  /\bdiagnos(?:a|is)?\b/,
  /\bgejala\b/,
  /\bterapi\b/,
  /\bobat\b/,
  /\brokok\b/,
  /\bkanker\b/,
  /\bparu\b/,
  /\bnyeri\b/,
  /\bdemam\b/,
  /\bbatuk\b/,
  /\bsesak\b/,
  /\bmual\b/,
  /\bmuntah\b/,
  /\bdiare\b/,
  /\bpusing\b/,
  /\binfeksi\b/,
  /\bhipertensi\b/,
  /\bdiabetes\b/,
  /\bfraktur\b/,
  /\basma\b/,
  /\bpneumonia\b/,
  /\btuberkulosis\b/,
  /\bmerokok\b/,
];

function hasMedicalContext(text: string) {
  const normalized = text.toLowerCase().trim();
  return MEDICAL_CONTEXT_PATTERNS.some((pattern) => pattern.test(normalized));
}

function formatNurseChatMessage(raw: string) {
  return raw
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function classifyNurseChatIntent(
  message: string,
  history: NurseChatHistoryMessage[] = []
): NurseChatRouteDecision {
  const normalized = message.toLowerCase().trim();
  const historyText = history.map((entry) => entry.message).join("\n").toLowerCase();
  const hasOperationalSignal = OPERATIONAL_PATTERNS.some((pattern) => pattern.test(normalized));
  const hasGeneralSignal = GENERAL_GUIDANCE_PATTERNS.some((pattern) => pattern.test(normalized));
  const hasMedicalSignal = hasMedicalContext(normalized);
  const hasMedicalHistoryContext = hasMedicalContext(historyText);

  if (hasOperationalSignal && hasGeneralSignal) {
    return {
      intent: "hybrid",
      reason: "Pesan memuat kebutuhan data operasional dan panduan penanganan umum.",
    };
  }

  if (hasOperationalSignal) {
    return {
      intent: "operational",
      reason: "Pesan memerlukan data sistem seperti stok obat, daftar pasien, atau ringkasan pasien.",
    };
  }

  if (hasGeneralSignal || hasMedicalSignal || hasMedicalHistoryContext) {
    return {
      intent: "general_guidance",
      reason: hasGeneralSignal || hasMedicalSignal
        ? "Pesan meminta panduan penanganan umum atau observasi pasien."
        : "Pesan adalah follow-up yang masih berada dalam konteks medis dari percakapan sebelumnya.",
    };
  }

  return {
    intent: "out_of_scope",
    reason: "Pesan berada di luar konteks medis, keperawatan, atau operasional perawat.",
  };
}

export async function routeNurseChat(
  message: string,
  history: NurseChatHistoryMessage[] = []
): Promise<NurseChatResponse> {
  const decision = classifyNurseChatIntent(message, history);

  if (decision.intent === "operational") {
    const result = await operationalChat(message, history);
    return {
      ...result,
      message: formatNurseChatMessage(result.message),
      intent: decision.intent,
      delegatedAgents: ["operational"],
    };
  }

  if (decision.intent === "hybrid") {
    const [operationalResult, generalResult] = await Promise.all([
      operationalChat(message, history),
      generalGuidanceChat(message, history),
    ]);

    return {
      success: true,
      message: formatNurseChatMessage([
        "Informasi Operasional",
        operationalResult.message,
        "",
        "Panduan Umum",
        generalResult.message,
      ].join("\n")),
      intent: decision.intent,
      delegatedAgents: ["operational", "general_guidance"],
      toolsUsed: operationalResult.toolsUsed,
      timestamp: new Date().toISOString(),
    };
  }

  if (decision.intent === "out_of_scope") {
    return {
      success: true,
      message: formatNurseChatMessage(
        "Saya hanya bisa membantu untuk pertanyaan yang masih terkait konteks medis, keperawatan, atau operasional perawat. Pertanyaan ini berada di luar konteks tersebut, jadi saya tidak bisa menjawab isinya. Jika perlu, silakan ubah pertanyaannya ke konteks pasien, penanganan, observasi, obat, atau data pasien yang sedang ditangani."
      ),
      intent: decision.intent,
      delegatedAgents: [],
      toolsUsed: [],
      timestamp: new Date().toISOString(),
    };
  }

  const result = await generalGuidanceChat(message, history);
  return {
    ...result,
    message: formatNurseChatMessage(result.message),
    intent: decision.intent,
    delegatedAgents: ["general_guidance"],
  };
}

export async function getNurseChatStatus() {
  const [operational, general] = await Promise.all([
    getOperationalAgentStatus(),
    getGeneralGuidanceAgentStatus(),
  ]);

  return {
    status: "ready",
    modes: {
      operational,
      general,
    },
    routing: {
      operational:
        "stok obat, ketersediaan obat, daftar pasien yang ditangani, ringkasan singkat pasien",
      general:
        "penanganan umum pasien, observasi awal, edukasi, rekomendasi tindakan umum",
    },
  };
}
