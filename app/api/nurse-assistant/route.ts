import { NextRequest, NextResponse } from "next/server";

import { getOperationalAgentStatus, operationalChat } from "@/lib/operational-agent";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required and must be a string" },
        { status: 400 }
      );
    }

    const result = await operationalChat(message);

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process nurse assistant request" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const status = await getOperationalAgentStatus();
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load nurse assistant status" },
      { status: 500 }
    );
  }
}
