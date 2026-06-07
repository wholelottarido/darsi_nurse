import { NextRequest, NextResponse } from 'next/server';

import { chat } from '@/lib/agent';
import { getClinicalLlmConfig } from '@/lib/llm-router';
import { saveAgentInteractionLog } from '@/lib/agent-interaction-logs';
import {
  saveAgentDataSourceLogs,
  saveAgentPerformanceLog,
  type SaveAgentDataSourceLogInput,
} from '@/lib/agent-observability-details';
import { getConversationHistory } from '@/lib/conversations';
import { getCurrentPerawat } from '@/lib/nurse-auth';
import { listVisitSummaries, resolveVisitContext } from '@/lib/visit-context';

async function persistInteractionLog(input: Parameters<typeof saveAgentInteractionLog>[0]) {
  try {
    return await saveAgentInteractionLog(input);
  } catch (error) {
    console.error('Failed to save /api/chat interaction log:', error);
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
    console.error('Failed to save /api/chat detail logs:', error);
  }
}

function buildChatDataSourceLogs(
  interactionLogId: number,
  patientId: number | null,
  registrationId: number | null,
  triageVisitId: number | null,
  toolsUsed: string[]
): SaveAgentDataSourceLogInput[] {
  const logs: SaveAgentDataSourceLogInput[] = [
    {
      interactionLogId,
      sourceCategory: 'triage_chat_memory',
      tableName: 'conversations',
      fieldNames: ['patient_id', 'registration_id', 'triage_visit_id', 'role', 'message', 'created_at'],
      reason: 'Menyimpan dan membaca memory percakapan triage per kunjungan.',
      recordIdentifier: triageVisitId ? `triage_visit_id=${triageVisitId}` : registrationId ? `registration_id=${registrationId}` : null,
      sourceSummary: 'Riwayat triage chat pasien per kunjungan.',
    },
  ];

  if (patientId) {
    logs.push({
      interactionLogId,
      sourceCategory: 'patient_master',
      tableName: 'patients',
      fieldNames: ['id', 'no_rm', 'full_name', 'date_of_birth', 'medical_record'],
      reason: 'Memberi konteks identitas dan data dasar pasien untuk triage chat.',
      recordIdentifier: `patient_id=${patientId}`,
      sourceSummary: 'Master pasien untuk konteks klinis.',
    });

    logs.push({
      interactionLogId,
      sourceCategory: 'clinical_context',
      tableName: 'external_examinations',
      fieldNames: ['soap_subjective', 'soap_objective', 'soap_assessment', 'soap_plan', 'diagnoses', 'registration_id'],
      reason: 'Mengambil SOAP awal dokter bila dibutuhkan agent klinis.',
      recordIdentifier: registrationId ? `registration_id=${registrationId}` : `patient_id=${patientId}`,
      sourceSummary: 'SOAP dokter sebagai baseline konteks klinis.',
      metadata: { inferred: true, toolsUsed },
    });

    logs.push({
      interactionLogId,
      sourceCategory: 'clinical_context',
      tableName: 'clinical_notes',
      fieldNames: ['patient_condition', 'summary', 'assessment', 'plan', 'triage_level', 'registration_id', 'triage_visit_id'],
      reason: 'Mengambil kondisi terbaru pasien dan hasil clinical notes pada kunjungan aktif.',
      recordIdentifier: triageVisitId ? `triage_visit_id=${triageVisitId}` : `patient_id=${patientId}`,
      sourceSummary: 'Clinical notes terbaru sebagai konteks triage.',
      metadata: { inferred: true, toolsUsed },
    });
  }

  return logs;
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const clinicalLlmConfig = getClinicalLlmConfig();
  let logMessage: string | null = null;
  let logPatientId: number | null = null;
  let logRegistrationId: number | null = null;
  let logTriageVisitId: number | null = null;
  let logPerawat: Awaited<ReturnType<typeof getCurrentPerawat>> | null = null;

  try {
    const body = await request.json();
    const { message, patientId, registrationId, triageVisitId } = body;
    const perawat = await getCurrentPerawat();
    logPerawat = perawat;

    logMessage = typeof message === 'string' ? message : null;
    logPatientId = Number.isFinite(Number(patientId)) ? Number(patientId) : null;
    logRegistrationId = registrationId !== undefined && registrationId !== null && Number.isFinite(Number(registrationId))
      ? Number(registrationId)
      : null;
    logTriageVisitId = triageVisitId !== undefined && triageVisitId !== null && Number.isFinite(Number(triageVisitId))
      ? Number(triageVisitId)
      : null;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    if (patientId && typeof patientId !== 'string') {
      return NextResponse.json(
        { error: 'PatientId must be a string' },
        { status: 400 }
      );
    }

    if (registrationId !== undefined && registrationId !== null && !Number.isFinite(Number(registrationId))) {
      return NextResponse.json(
        { error: 'registrationId must be a number' },
        { status: 400 }
      );
    }

    if (triageVisitId !== undefined && triageVisitId !== null && !Number.isFinite(Number(triageVisitId))) {
      return NextResponse.json(
        { error: 'triageVisitId must be a number' },
        { status: 400 }
      );
    }

    console.log('📨 Chat API - Received message:', {
      messageLength: message.length,
      patientId,
    });

    const resolvedVisitId = logTriageVisitId ?? logRegistrationId;
    const llmStartedAt = Date.now();
    const result = await chat(message, patientId, resolvedVisitId);
    const llmLatencyMs = Date.now() - llmStartedAt;
    const totalLatencyMs = Date.now() - startedAt;

    if (!result.success) {
      const interactionLog = await persistInteractionLog({
        routeName: '/api/chat',
        agentType: 'clinical',
        requestKind: 'triage_chat',
        nurseId: perawat?.id ?? null,
        nurseUsername: perawat?.username ?? null,
        nurseName: perawat?.namaLengkap ?? null,
        patientId: logPatientId,
        registrationId: logRegistrationId,
        triageVisitId: logTriageVisitId,
        requestMessage: message,
        responseMessage: null,
        success: false,
        errorMessage: result.error || 'Failed to process message',
        toolsUsed: result.toolsUsed || [],
        latencyMs: totalLatencyMs,
        metadata: {
          modelsUsed: [clinicalLlmConfig.displayName],
          primaryModel: clinicalLlmConfig.displayName,
        },
      });

      if (interactionLog) {
        await persistInteractionDetails(
          interactionLog.id,
          buildChatDataSourceLogs(interactionLog.id, logPatientId, logRegistrationId, logTriageVisitId, result.toolsUsed || []),
          {
            interactionLogId: interactionLog.id,
            routeName: '/api/chat',
            agentType: 'clinical',
            totalLatencyMs,
            llmLatencyMs,
            toolLatencyMs: result.toolsUsed?.length ? llmLatencyMs : 0,
            success: false,
            errorMessage: result.error || 'Failed to process message',
            metadata: {
              toolsUsed: result.toolsUsed || [],
            },
          }
        );
      }

      return NextResponse.json(
        { error: result.error || 'Failed to process message' },
        { status: 500 }
      );
    }

    const interactionLog = await persistInteractionLog({
      routeName: '/api/chat',
      agentType: 'clinical',
      requestKind: 'triage_chat',
      nurseId: perawat?.id ?? null,
      nurseUsername: perawat?.username ?? null,
      nurseName: perawat?.namaLengkap ?? null,
      patientId: logPatientId,
      registrationId: logRegistrationId,
      triageVisitId: logTriageVisitId,
      requestMessage: message,
      responseMessage: result.message,
      success: true,
      toolsUsed: result.toolsUsed || [],
      latencyMs: totalLatencyMs,
      metadata: {
        modelsUsed: [clinicalLlmConfig.displayName],
        primaryModel: clinicalLlmConfig.displayName,
      },
    });

    if (interactionLog) {
      await persistInteractionDetails(
        interactionLog.id,
        buildChatDataSourceLogs(interactionLog.id, logPatientId, logRegistrationId, logTriageVisitId, result.toolsUsed || []),
        {
          interactionLogId: interactionLog.id,
          routeName: '/api/chat',
          agentType: 'clinical',
          totalLatencyMs,
          llmLatencyMs,
          toolLatencyMs: result.toolsUsed?.length ? llmLatencyMs : 0,
          success: true,
          metadata: {
            toolsUsed: result.toolsUsed || [],
          },
        }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      toolsUsed: result.toolsUsed || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ Chat API error:', error);

    const perawat = logPerawat ?? await getCurrentPerawat().catch(() => null);
    const totalLatencyMs = Date.now() - startedAt;
    const interactionLog = await persistInteractionLog({
      routeName: '/api/chat',
      agentType: 'clinical',
      requestKind: 'triage_chat',
      nurseId: perawat?.id ?? null,
      nurseUsername: perawat?.username ?? null,
      nurseName: perawat?.namaLengkap ?? null,
      patientId: logPatientId,
      registrationId: logRegistrationId,
      triageVisitId: logTriageVisitId,
      requestMessage: logMessage,
      responseMessage: null,
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Internal server error',
      latencyMs: totalLatencyMs,
      metadata: {
        modelsUsed: [clinicalLlmConfig.displayName],
        primaryModel: clinicalLlmConfig.displayName,
      },
    });

    if (interactionLog) {
      await persistInteractionDetails(
        interactionLog.id,
        buildChatDataSourceLogs(interactionLog.id, logPatientId, logRegistrationId, logTriageVisitId, []),
        {
          interactionLogId: interactionLog.id,
          routeName: '/api/chat',
          agentType: 'clinical',
          totalLatencyMs,
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Internal server error',
        }
      );
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const patientIdRaw = searchParams.get('patientId');
  const registrationIdRaw = searchParams.get('registrationId');
  const triageVisitIdRaw = searchParams.get('triageVisitId');
  const limitRaw = searchParams.get('limit');

  if (!patientIdRaw) {
    return NextResponse.json({
      message: 'Chat API endpoint',
      method: 'POST',
      body: {
        message: 'string (required)',
        patientId: 'string (optional, UUID format)',
      },
    });
  }

  const patientId = Number(patientIdRaw);
  if (!Number.isFinite(patientId)) {
    return NextResponse.json(
      { error: 'patientId must be a number' },
      { status: 400 }
    );
  }
  const registrationId = registrationIdRaw ? Number(registrationIdRaw) : null;
  if (registrationIdRaw && !Number.isFinite(registrationId)) {
    return NextResponse.json(
      { error: 'registrationId must be a number' },
      { status: 400 }
    );
  }
  const triageVisitId = triageVisitIdRaw ? Number(triageVisitIdRaw) : null;
  if (triageVisitIdRaw && !Number.isFinite(triageVisitId)) {
    return NextResponse.json(
      { error: 'triageVisitId must be a number' },
      { status: 400 }
    );
  }

  const limit = Math.max(1, Math.min(100, Number(limitRaw ?? '50')));

  try {
    const activeVisitContext = await resolveVisitContext(patientId);
    const visitContext = triageVisitId
      ? await resolveVisitContext(patientId, triageVisitId)
      : activeVisitContext;
    const [messages, visits] = await Promise.all([
      getConversationHistory(visitContext, limit),
      listVisitSummaries(patientId),
    ]);

    return NextResponse.json({
      messages,
      triageVisitId: visitContext.triageVisitId,
      activeTriageVisitId: activeVisitContext.triageVisitId,
      registrationId: visitContext.registrationId,
      activeRegistrationId: activeVisitContext.registrationId,
      visits,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load conversation history' },
      { status: 500 }
    );
  }
}
