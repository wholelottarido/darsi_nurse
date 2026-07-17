import { NextRequest, NextResponse } from "next/server";

import { saveAgentInteractionLog } from "@/lib/logging/agent-interaction-logs";
import {
  saveAgentDataSourceLogs,
  saveAgentPerformanceLog,
  type SaveAgentDataSourceLogInput,
} from "@/lib/logging/agent-observability-details";
import {
  buildSessionTitleFromMessage,
  createNurseChatSession,
  ensureDefaultNurseChatSession,
  getNurseChatHistory,
  getNurseChatSession,
  listNurseChatSessions,
  saveNurseChatMessage,
  updateNurseChatSessionTitle,
} from "@/lib/conversations/nurse-chat-history";
import { getCurrentPerawat } from "@/lib/auth/nurse-auth";
import { getNurseChatStatus, routeNurseChat } from "@/lib/conversations/nurse-chat-router";
import { getGeneralGuidanceLlmConfig, getOperationalLlmConfig } from "@/lib/agents/llm-router";

async function persistInteractionLog(input: Parameters<typeof saveAgentInteractionLog>[0]) {
  try {
    return await saveAgentInteractionLog(input);
  } catch (error) {
    console.error("Failed to save /api/nurse-chat interaction log:", error);
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
    console.error("Failed to save /api/nurse-chat detail logs:", error);
  }
}

function buildNurseChatDataSourceLogs(
  interactionLogId: number,
  input: {
    intent: "operational" | "general_guidance" | "hybrid" | "out_of_scope";
    toolsUsed: string[];
    sessionId: number;
  }
): SaveAgentDataSourceLogInput[] {
  const logs: SaveAgentDataSourceLogInput[] = [
    {
      interactionLogId,
      sourceCategory: "nurse_chat_memory",
      tableName: "nurse_chat_conversations",
      fieldNames: ["session_id", "role", "message", "intent", "tools_used", "created_at"],
      reason: "Memuat dan menyimpan riwayat chat asisten perawat per session.",
      recordIdentifier: `session_id=${input.sessionId}`,
      sourceSummary: "Riwayat chat asisten perawat per thread.",
    },
  ];

  if (input.intent === "general_guidance") {
    return logs;
  }

  if (input.toolsUsed.includes("check_medicine_availability")) {
    logs.push({
      interactionLogId,
      sourceCategory: "medicine_stock",
      tableName: "darsi_ph_stok_obat",
      fieldNames: ["nomor_obat", "nama", "stok", "satuan", "expired_at", "lokasi", "status", "source"],
      reason: "Menjawab pertanyaan ketersediaan obat dari stok farmasi rumah sakit.",
      sourceSummary: "Data stok obat operasional.",
    });
  }

  if (input.toolsUsed.includes("list_assigned_patients")) {
    logs.push(
      {
        interactionLogId,
        sourceCategory: "patient_assignment",
        tableName: "registrations",
        fieldNames: ["id", "status", "registration_date", "patient_id", "doctor_id"],
        reason: "Menyusun daftar pasien yang sedang ditangani perawat.",
        sourceSummary: "Registrasi pasien aktif per perawat.",
      },
      {
        interactionLogId,
        sourceCategory: "patient_assignment",
        tableName: "patients",
        fieldNames: ["id", "no_rm", "full_name", "date_of_birth"],
        reason: "Mengambil identitas pasien untuk daftar tanggungan.",
        sourceSummary: "Master identitas pasien.",
      },
      {
        interactionLogId,
        sourceCategory: "patient_assignment",
        tableName: "clinical_notes",
        fieldNames: ["id", "summary", "triage_level", "patient_condition", "registration_id"],
        reason: "Menampilkan kondisi pasien dan triage terbaru pada daftar tanggungan.",
        sourceSummary: "Ringkasan klinis terbaru per pasien.",
      }
    );
  }

  if (input.toolsUsed.includes("get_assigned_patient_summary")) {
    logs.push(
      {
        interactionLogId,
        sourceCategory: "patient_summary",
        tableName: "patients",
        fieldNames: ["id", "no_rm", "full_name", "date_of_birth"],
        reason: "Mencari identitas pasien untuk ringkasan singkat.",
        sourceSummary: "Master identitas pasien.",
      },
      {
        interactionLogId,
        sourceCategory: "patient_summary",
        tableName: "clinical_notes",
        fieldNames: ["summary", "assessment", "plan", "medication_recommendation", "triage_level", "patient_condition"],
        reason: "Mengambil ringkasan klinis terbaru pasien yang sedang ditangani perawat.",
        sourceSummary: "Clinical note terbaru pasien.",
      },
      {
        interactionLogId,
        sourceCategory: "patient_summary",
        tableName: "external_examinations",
        fieldNames: ["diagnoses", "doctor_username", "status"],
        reason: "Melengkapi ringkasan pasien dengan konteks pemeriksaan dokter.",
        sourceSummary: "SOAP dan diagnosis dokter bila tersedia.",
      }
    );
  }

  return logs;
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const operationalLlmConfig = getOperationalLlmConfig();
  const generalLlmConfig = getGeneralGuidanceLlmConfig();
  let logMessage: string | null = null;
  let logSessionId: number | null = null;
  let logPerawat: Awaited<ReturnType<typeof getCurrentPerawat>> | null = null;

  try {
    const perawat = await getCurrentPerawat();
    logPerawat = perawat;

    if (!perawat) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, message, sessionId, createNewSession } = body;

    if (action === "createSession") {
      const session = await createNurseChatSession(perawat.id, "Chat baru");
      const sessions = await listNurseChatSessions(perawat.id, 40);

      return NextResponse.json({
        success: true,
        session,
        sessions,
        activeSessionId: session.id,
        history: [],
      });
    }

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required and must be a string" },
        { status: 400 }
      );
    }

    logMessage = message;

    const session = createNewSession || !sessionId
      ? await createNurseChatSession(perawat.id, buildSessionTitleFromMessage(message))
      : { id: Number(sessionId) };

    logSessionId = session.id;

    await saveNurseChatMessage({
      nurseId: perawat.id,
      sessionId: session.id,
      role: "user",
      message,
    });

    const currentSession = await getNurseChatSession(session.id, perawat.id);
    const nextTitle = buildSessionTitleFromMessage(message);

    if (!currentSession || !currentSession.title || currentSession.title.trim().toLowerCase() === "chat baru") {
      await updateNurseChatSessionTitle(session.id, nextTitle);
    }

    const historyForModel = await getNurseChatHistory(session.id, perawat.id, 12);

    const llmStartedAt = Date.now();
    const result = await routeNurseChat(
      message,
      historyForModel.map((entry) => ({
        role: entry.role,
        message: entry.message,
      }))
    );
    const llmLatencyMs = Date.now() - llmStartedAt;

    const modelsUsed = result.intent === "hybrid"
      ? [operationalLlmConfig.displayName, generalLlmConfig.displayName]
      : result.intent === "operational"
        ? [operationalLlmConfig.displayName]
        : result.intent === "general_guidance"
          ? [generalLlmConfig.displayName]
          : [];
    const primaryModel = result.intent === "general_guidance"
      ? generalLlmConfig.displayName
      : result.intent === "operational" || result.intent === "hybrid"
        ? operationalLlmConfig.displayName
        : null;

    await saveNurseChatMessage({
      nurseId: perawat.id,
      sessionId: session.id,
      role: "assistant",
      message: result.message,
      intent: result.intent,
      delegatedAgents: result.delegatedAgents,
      toolsUsed: result.toolsUsed,
    });

    const interactionLog = await persistInteractionLog({
      routeName: "/api/nurse-chat",
      agentType: result.intent === "hybrid" ? "hybrid" : result.intent,
      requestKind: "nurse_assistant_chat",
      nurseId: perawat.id,
      nurseUsername: perawat.username,
      nurseName: perawat.namaLengkap,
      sessionId: session.id,
      intent: result.intent,
      delegatedAgents: result.delegatedAgents,
      toolsUsed: result.toolsUsed,
      requestMessage: message,
      responseMessage: result.message,
      success: true,
      latencyMs: Date.now() - startedAt,
      metadata: {
        modelsUsed,
        primaryModel,
      },
    });

    if (interactionLog) {
      await persistInteractionDetails(
        interactionLog.id,
        buildNurseChatDataSourceLogs(interactionLog.id, {
          intent: result.intent,
          toolsUsed: result.toolsUsed,
          sessionId: session.id,
        }),
        {
          interactionLogId: interactionLog.id,
          routeName: "/api/nurse-chat",
          agentType: result.intent === "hybrid" ? "hybrid" : result.intent,
          totalLatencyMs: Date.now() - startedAt,
          llmLatencyMs,
          toolLatencyMs: result.toolsUsed.length > 0 ? llmLatencyMs : 0,
          success: true,
          metadata: {
            delegatedAgents: result.delegatedAgents,
            toolsCount: result.toolsUsed.length,
            sessionId: session.id,
            modelsUsed,
            primaryModel,
          },
        }
      );
    }

    const [sessions, history] = await Promise.all([
      listNurseChatSessions(perawat.id, 40),
      getNurseChatHistory(session.id, perawat.id, 100),
    ]);

    return NextResponse.json({
      ...result,
      sessionId: session.id,
      sessions,
      history,
    });
  } catch (error) {
    console.error("Failed to process /api/nurse-chat request:", error);
    const totalLatencyMs = Date.now() - startedAt;
    const interactionLog = await persistInteractionLog({
      routeName: "/api/nurse-chat",
      agentType: "nurse_assistant",
      requestKind: "nurse_assistant_chat",
      nurseId: logPerawat?.id ?? null,
      nurseUsername: logPerawat?.username ?? null,
      nurseName: logPerawat?.namaLengkap ?? null,
      sessionId: logSessionId,
      requestMessage: logMessage,
      responseMessage: null,
      success: false,
      errorMessage: error instanceof Error ? error.message : "Failed to process nurse chat request",
      latencyMs: totalLatencyMs,
    });

    if (interactionLog) {
      await persistInteractionDetails(
        interactionLog.id,
        buildNurseChatDataSourceLogs(interactionLog.id, {
          intent: "general_guidance",
          toolsUsed: [],
          sessionId: logSessionId ?? 0,
        }),
        {
          interactionLogId: interactionLog.id,
          routeName: "/api/nurse-chat",
          agentType: "nurse_assistant",
          totalLatencyMs,
          success: false,
          errorMessage: error instanceof Error ? error.message : "Failed to process nurse chat request",
          metadata: {
            sessionId: logSessionId,
            modelsUsed: [operationalLlmConfig.displayName, generalLlmConfig.displayName],
            primaryModel: operationalLlmConfig.displayName,
          },
        }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process nurse chat request" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const perawat = await getCurrentPerawat();
    if (!perawat) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const sessionIdParam = url.searchParams.get("sessionId");

    const status = await getNurseChatStatus();
    let sessions = await listNurseChatSessions(perawat.id, 40);

    const defaultSession = sessionIdParam
      ? sessions.find((item) => item.id === Number(sessionIdParam)) ?? null
      : sessions[0] ?? (await ensureDefaultNurseChatSession(perawat.id));

    if (!sessions.some((item) => item.id === defaultSession?.id)) {
      sessions = await listNurseChatSessions(perawat.id, 40);
    }

    const history = defaultSession
      ? await getNurseChatHistory(defaultSession.id, perawat.id, 100)
      : [];

    return NextResponse.json({
      ...status,
      sessions,
      activeSessionId: defaultSession?.id ?? null,
      history,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load nurse chat status" },
      { status: 500 }
    );
  }
}
