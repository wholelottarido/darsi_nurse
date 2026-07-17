import { Agent } from "@voltagent/core";

import { getOperationalLlmConfig, getOperationalModel } from "@/lib/agents/llm-router";
import {
  checkMedicineAvailability,
  getAssignedPatientSummary,
  getAssignedPatients,
  operationalTools,
} from "@/lib/tools/operational-tools";

type AgentToolResult = {
  toolName?: string;
  validationErrors?: Record<string, unknown>;
  result?: unknown;
};

type AssignedPatientToolPayload = {
  total?: number;
  patients?: Array<{
    full_name?: string;
    no_rm?: string;
    age?: number | null;
    doctor_name?: string;
    triage_level?: string;
    registration_status?: string;
    patient_condition?: string;
  }>;
};

type AgentGenerationResult = {
  text: string | Promise<string>;
  toolResults?: AgentToolResult[];
};

type MedicineAvailabilityItem = {
  nomor_obat?: string;
  nama?: string;
  stok?: number;
  satuan?: string;
  expired_at?: string | null;
  lokasi?: string;
  status?: string;
};

function isAssignedPatientsRequest(message: string) {
  const normalized = message.toLowerCase();
  return /\b(daftar pasien|pasien (yang )?saya tangani|pasien saya|siapa saja pasien)\b/.test(normalized);
}

function isMedicineAvailabilityRequest(message: string) {
  const normalized = message.toLowerCase();
  return /\b(stok|ketersediaan|tersedia|habis|kosong|obat|farmasi)\b/.test(normalized);
}

function isPatientSummaryRequest(message: string) {
  const normalized = message.toLowerCase();
  return /\b(ringkasan|summary|resume)\b/.test(normalized) && /\bpasien\b/.test(normalized);
}

function extractMedicineKeyword(message: string) {
  return message
    .replace(/apakah/gi, "")
    .replace(/(stok|ketersediaan|tersedia|habis|kosong|obat|farmasi|ada|cek|tolong|di|saat ini|\?)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPatientQuery(message: string) {
  const rmMatch = message.match(/\bRM\d+\b/i);
  if (rmMatch) return rmMatch[0];

  return message
    .replace(/(tolong|cek|lihat|ringkasan|summary|resume|singkat|pasien|no rm|nrm|dengan|atas nama|bernama|\?)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatMedicineAvailabilityResponse(items: MedicineAvailabilityItem[], keyword: string) {
  if (items.length === 0) {
    return `Saya belum menemukan stok obat untuk "${keyword}" di data farmasi. Coba gunakan nama obat yang lebih spesifik atau cek langsung ke farmasi.`;
  }

  const lines = [`Berikut hasil cek stok obat untuk "${keyword}":`, ""];
  items.forEach((item, index) => {
    lines.push(`${index + 1}. **${item.nama || "Obat"}**`);
    lines.push(`   - **Kode:** ${item.nomor_obat || "-"}`);
    lines.push(`   - **Stok:** ${item.stok ?? 0} ${item.satuan || ""}`.trim());
    lines.push(`   - **Lokasi:** ${item.lokasi || "-"}`);
    lines.push(`   - **Status:** ${item.status || "-"}`);
    lines.push("");
  });
  return lines.join("\n").trim();
}

async function tryDirectOperationalResponse(userMessage: string) {
  if (isAssignedPatientsRequest(userMessage)) {
    const patients = await getAssignedPatients(20);
    return {
      success: true,
      message: formatAssignedPatientsResponse({ total: patients.length, patients }),
      toolsUsed: ["list_assigned_patients"],
      timestamp: new Date().toISOString(),
    };
  }

  if (isPatientSummaryRequest(userMessage)) {
    const patientQuery = extractPatientQuery(userMessage);
    if (patientQuery) {
      const payload = await getAssignedPatientSummary(patientQuery);
      if (!payload) {
        return {
          success: true,
          message: `Saya belum menemukan pasien "${patientQuery}" pada daftar pasien yang sedang Anda tangani.`,
          toolsUsed: ["get_assigned_patient_summary"],
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        message: [
          `Ringkasan pasien **${payload.full_name}**`,
          `- **No. RM:** ${payload.no_rm}`,
          typeof payload.age === "number" ? `- **Usia:** ${payload.age} tahun` : null,
          `- **Dokter:** ${payload.doctor_name || "-"}`,
          `- **Triage:** ${payload.triage_level || "-"}`,
          `- **Kondisi:** ${payload.patient_condition || "-"}`,
          `- **Ringkasan:** ${payload.summary || "-"}`,
          `- **Assessment:** ${payload.assessment || "-"}`,
          `- **Plan:** ${payload.plan || "-"}`,
          `- **Rekomendasi obat:** ${payload.medication_recommendation || "-"}`,
          `- **Diagnosis:** ${payload.diagnoses || "-"}`,
        ].filter(Boolean).join("\n"),
        toolsUsed: ["get_assigned_patient_summary"],
        timestamp: new Date().toISOString(),
      };
    }
  }

  if (isMedicineAvailabilityRequest(userMessage)) {
    const keyword = extractMedicineKeyword(userMessage);
    if (keyword) {
      const items = await checkMedicineAvailability(keyword);
      return {
        success: true,
        message: formatMedicineAvailabilityResponse(items, keyword),
        toolsUsed: ["check_medicine_availability"],
        timestamp: new Date().toISOString(),
      };
    }
  }

  return null;
}

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

let operationalAgentInstance: Agent | null = null;

function formatAssignedPatientsResponse(payload: AssignedPatientToolPayload) {
  const patients = Array.isArray(payload.patients) ? payload.patients : [];
  if (patients.length === 0) {
    return "Saat ini belum ada pasien yang tercatat dalam daftar tanggungan Anda.";
  }

  const lines: string[] = [
    `Berikut daftar pasien yang sedang Anda tangani (total ${payload.total ?? patients.length} pasien):`,
    "",
  ];

  patients.forEach((patient, index) => {
    lines.push(`${index + 1}. **${patient.full_name || "Pasien"}**`);
    lines.push(`   - **No. RM:** ${patient.no_rm || "-"}`);
    if (typeof patient.age === "number") {
      lines.push(`   - **Usia:** ${patient.age} tahun`);
    }
    lines.push(`   - **Dokter:** ${patient.doctor_name || "-"}`);
    lines.push(`   - **Triage:** ${patient.triage_level || "-"}`);
    lines.push(`   - **Status:** ${patient.registration_status || "-"}`);
    lines.push(`   - **Kondisi:** ${patient.patient_condition || "-"}`);
    lines.push("");
  });

  lines.push("Kalau Anda ingin, saya bisa bantu tampilkan ringkasan lebih detail untuk salah satu pasien berdasarkan nama atau No. RM.");
  return lines.join("\n").trim();
}

function buildOperationalResponse(text: string, toolResults?: AgentToolResult[]) {
  const assignedPatientsResult = Array.isArray(toolResults)
    ? toolResults.find((item) => item.toolName === "list_assigned_patients")
    : null;

  if (assignedPatientsResult?.result && typeof assignedPatientsResult.result === "object") {
    return formatAssignedPatientsResponse(assignedPatientsResult.result as AssignedPatientToolPayload);
  }

  return text;
}

async function initializeOperationalAgent() {
  if (operationalAgentInstance) {
    return operationalAgentInstance;
  }

  const llmConfig = getOperationalLlmConfig();

  operationalAgentInstance = new Agent({
    name: "DARSI Operational Nurse Agent",
    instructions: `Anda adalah asisten operasional untuk perawat yang terdengar membantu, hangat, dan profesional.

Fokus Anda:
- cek ketersediaan obat
- daftar pasien yang sedang ditangani perawat
- ringkasan singkat pasien yang sedang ditangani

Gaya jawaban:
- Gunakan Bahasa Indonesia yang sopan, membantu, dan mudah dipindai.
- Mulai dengan jawaban inti secara langsung, lalu lanjutkan detail penting.
- Gunakan markdown rapi bila membantu, misalnya **bold** untuk hasil penting, *italic* untuk penekanan ringan, dan list untuk rincian.
- Jika relevan, gunakan label singkat seperti "Ketersediaan", "Ringkasan", atau "Catatan".
- Hindari nada kaku, terlalu robotik, atau terlalu panjang.
- Jika data tidak ditemukan, sampaikan dengan halus dan tetap beri arahan langkah berikutnya.
- Jangan gunakan tabel markdown atau format kolom dengan tanda pipa |.
- Untuk daftar pasien, selalu gunakan format list bernomor per pasien.
- Setelah nama pasien, tampilkan detail penting ke bawah, satu baris per field.
- Jangan gabungkan beberapa field dalam satu baris panjang.
- Contoh format yang diinginkan:
  1. **Nama Pasien**
     - **No. RM:** RM001
     - **Usia:** 36 tahun
     - **Dokter:** dr. ...
     - **Triage:** LOW
     - **Status:** dipanggil
     - **Kondisi:** ...

Aturan:
- Gunakan tools yang tersedia untuk semua pertanyaan yang memerlukan data sistem.
- Perhatikan konteks percakapan sebelumnya dalam session yang sama agar follow-up user tetap konsisten dengan permintaan sebelumnya.
- Jangan mengarang stok obat, daftar pasien, atau ringkasan pasien.
- Jangan menulis ke clinical notes atau mengubah data klinis.
- Jika user meminta beberapa hal sekaligus, jawab terstruktur dalam bagian-bagian singkat.
- Tutup jawaban dengan ajakan bantu lanjut hanya jika relevan, misalnya "Kalau perlu, saya bisa cek obat lain".
`,
    model: getOperationalModel(),
    markdown: true,
    tools: operationalTools,
    maxSteps: 8,
    temperature: 0,
  });

  console.log("✅ Operational agent initialized");
  console.log("🤖 Operational model:", llmConfig.model);
  return operationalAgentInstance;
}

export async function operationalChat(
  userMessage: string,
  history: NurseChatHistoryMessage[] = []
) {
  const directResponse = await tryDirectOperationalResponse(userMessage);
  if (directResponse) {
    return directResponse;
  }

  const agent = await initializeOperationalAgent();

  const result = (await agent.generateText(
    buildConversationMessages(userMessage, history),
    {
      maxOutputTokens: 1200,
      maxSteps: 8,
      timeout: 45000,
    }
  )) as AgentGenerationResult;

  const text = await result.text;
  const toolsUsed = Array.isArray(result.toolResults)
    ? result.toolResults.map((item) => item.toolName).filter((value): value is string => Boolean(value))
    : [];
  const message = buildOperationalResponse(text, result.toolResults);

  return {
    success: true,
    message,
    toolsUsed,
    timestamp: new Date().toISOString(),
  };
}

export async function getOperationalAgentStatus() {
  const llmConfig = getOperationalLlmConfig();
  return {
    status: "ready",
    model: llmConfig.model,
    provider: llmConfig.provider,
    baseUrl: llmConfig.baseUrl,
    toolsCount: operationalTools.length,
  };
}
