import { NextResponse } from "next/server";

import { getCurrentLogAdmin } from "@/lib/auth/admin-log-auth";
import { getAgentInteractionLogById } from "@/lib/logging/agent-interaction-logs";
import {
  listAgentDataSourceLogsByInteractionId,
  listAgentPerformanceLogsByInteractionId,
} from "@/lib/logging/agent-observability-details";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const admin = await getCurrentLogAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const interactionLogId = Number(id);
  if (!Number.isFinite(interactionLogId)) {
    return NextResponse.json({ error: "Invalid interaction log id" }, { status: 400 });
  }

  const [interactionLog, dataSourceLogs, performanceLogs] = await Promise.all([
    getAgentInteractionLogById(interactionLogId),
    listAgentDataSourceLogsByInteractionId(interactionLogId),
    listAgentPerformanceLogsByInteractionId(interactionLogId),
  ]);

  if (!interactionLog) {
    return NextResponse.json({ error: "Interaction log not found" }, { status: 404 });
  }

  return NextResponse.json({
    interactionLog,
    dataSourceLogs,
    performanceLogs,
  });
}
