import { NextRequest, NextResponse } from 'next/server';
import { chat } from '@/lib/agent';
import { getConversationHistory } from '@/lib/conversations';
import { listVisitSummaries, resolveVisitContext } from '@/lib/visit-context';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, patientId, registrationId, triageVisitId } = body;

    // Validation
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

    // Call agent - agent will call tools as needed
    const result = await chat(
      message,
      patientId,
      triageVisitId !== undefined && triageVisitId !== null
        ? Number(triageVisitId)
        : (registrationId !== undefined && registrationId !== null ? Number(registrationId) : null)
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to process message' },
        { status: 500 }
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
