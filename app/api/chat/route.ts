import { NextRequest, NextResponse } from 'next/server';
import { chat } from '@/lib/agent';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, patientId } = body;

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

    console.log('📨 Chat API - Received message:', {
      messageLength: message.length,
      patientId,
    });

    // Call agent - agent will call tools as needed
    const result = await chat(message, patientId);

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

export async function GET() {
  return NextResponse.json({
    message: 'Chat API endpoint',
    method: 'POST',
    body: {
      message: 'string (required)',
      patientId: 'string (optional, UUID format)',
    },
  });
}
