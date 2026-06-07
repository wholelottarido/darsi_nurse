import os from "os";

import { hospitalQuery } from "@/lib/hospital-db";

export type AgentDataSourceLog = {
  id: number;
  created_at: string;
  interaction_log_id: number;
  source_category: string;
  table_name: string;
  field_names: string[];
  reason: string | null;
  record_identifier: string | null;
  source_summary: string | null;
  metadata: Record<string, unknown> | null;
};

export type AgentPerformanceLog = {
  id: number;
  created_at: string;
  interaction_log_id: number;
  route_name: string;
  agent_type: string;
  total_latency_ms: number | null;
  llm_latency_ms: number | null;
  db_latency_ms: number | null;
  tool_latency_ms: number | null;
  success: boolean;
  error_message: string | null;
  cpu_load_1m: number | null;
  memory_rss_mb: number | null;
  heap_used_mb: number | null;
  metadata: Record<string, unknown> | null;
};

export type SaveAgentDataSourceLogInput = {
  interactionLogId: number;
  sourceCategory: string;
  tableName: string;
  fieldNames?: string[];
  reason?: string | null;
  recordIdentifier?: string | null;
  sourceSummary?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type SaveAgentPerformanceLogInput = {
  interactionLogId: number;
  routeName: string;
  agentType: string;
  totalLatencyMs?: number | null;
  llmLatencyMs?: number | null;
  dbLatencyMs?: number | null;
  toolLatencyMs?: number | null;
  success: boolean;
  errorMessage?: string | null;
  cpuLoad1m?: number | null;
  memoryRssMb?: number | null;
  heapUsedMb?: number | null;
  metadata?: Record<string, unknown> | null;
};

const globalForObservabilityDetails = globalThis as typeof globalThis & {
  __agentObservabilityDetailsReady?: Promise<void>;
};

function normalizeText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeStringArray(value?: string[] | null) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value.map((item) => String(item).trim()).filter(Boolean);
}

async function ensureObservabilityDetailTables() {
  if (!globalForObservabilityDetails.__agentObservabilityDetailsReady) {
    globalForObservabilityDetails.__agentObservabilityDetailsReady = (async () => {
      await hospitalQuery(`
        CREATE TABLE IF NOT EXISTS agent_data_source_logs (
          id BIGSERIAL PRIMARY KEY,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          interaction_log_id BIGINT NOT NULL REFERENCES agent_interaction_logs(id) ON DELETE CASCADE,
          source_category TEXT NOT NULL,
          table_name TEXT NOT NULL,
          field_names JSONB NOT NULL DEFAULT '[]'::jsonb,
          reason TEXT,
          record_identifier TEXT,
          source_summary TEXT,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb
        )
      `);
      await hospitalQuery(`
        CREATE TABLE IF NOT EXISTS agent_performance_logs (
          id BIGSERIAL PRIMARY KEY,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          interaction_log_id BIGINT NOT NULL REFERENCES agent_interaction_logs(id) ON DELETE CASCADE,
          route_name TEXT NOT NULL,
          agent_type TEXT NOT NULL,
          total_latency_ms INTEGER,
          llm_latency_ms INTEGER,
          db_latency_ms INTEGER,
          tool_latency_ms INTEGER,
          success BOOLEAN NOT NULL DEFAULT TRUE,
          error_message TEXT,
          cpu_load_1m DOUBLE PRECISION,
          memory_rss_mb DOUBLE PRECISION,
          heap_used_mb DOUBLE PRECISION,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb
        )
      `);
      await hospitalQuery(`CREATE INDEX IF NOT EXISTS idx_agent_data_source_logs_interaction_id ON agent_data_source_logs(interaction_log_id)`);
      await hospitalQuery(`CREATE INDEX IF NOT EXISTS idx_agent_data_source_logs_table_name ON agent_data_source_logs(table_name)`);
      await hospitalQuery(`CREATE INDEX IF NOT EXISTS idx_agent_performance_logs_interaction_id ON agent_performance_logs(interaction_log_id)`);
      await hospitalQuery(`CREATE INDEX IF NOT EXISTS idx_agent_performance_logs_route_name ON agent_performance_logs(route_name)`);
    })().catch((error) => {
      globalForObservabilityDetails.__agentObservabilityDetailsReady = undefined;
      throw error;
    });
  }

  await globalForObservabilityDetails.__agentObservabilityDetailsReady;
}

export function getRuntimePerformanceSnapshot() {
  const memory = process.memoryUsage();
  const [cpuLoad1m] = os.loadavg();

  return {
    cpuLoad1m: Number.isFinite(cpuLoad1m) ? Number(cpuLoad1m.toFixed(3)) : null,
    memoryRssMb: Number((memory.rss / (1024 * 1024)).toFixed(2)),
    heapUsedMb: Number((memory.heapUsed / (1024 * 1024)).toFixed(2)),
  };
}

export async function saveAgentDataSourceLogs(entries: SaveAgentDataSourceLogInput[]) {
  if (entries.length === 0) {
    return;
  }

  await ensureObservabilityDetailTables();

  for (const entry of entries) {
    await hospitalQuery(
      `INSERT INTO agent_data_source_logs (
        interaction_log_id,
        source_category,
        table_name,
        field_names,
        reason,
        record_identifier,
        source_summary,
        metadata
      ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8::jsonb)`,
      [
        entry.interactionLogId,
        entry.sourceCategory,
        entry.tableName,
        JSON.stringify(normalizeStringArray(entry.fieldNames)),
        normalizeText(entry.reason),
        normalizeText(entry.recordIdentifier),
        normalizeText(entry.sourceSummary),
        JSON.stringify(entry.metadata ?? {}),
      ]
    );
  }
}

export async function saveAgentPerformanceLog(input: SaveAgentPerformanceLogInput) {
  await ensureObservabilityDetailTables();

  const runtime = {
    ...getRuntimePerformanceSnapshot(),
    cpuLoad1m: input.cpuLoad1m ?? getRuntimePerformanceSnapshot().cpuLoad1m,
    memoryRssMb: input.memoryRssMb ?? getRuntimePerformanceSnapshot().memoryRssMb,
    heapUsedMb: input.heapUsedMb ?? getRuntimePerformanceSnapshot().heapUsedMb,
  };

  await hospitalQuery(
    `INSERT INTO agent_performance_logs (
      interaction_log_id,
      route_name,
      agent_type,
      total_latency_ms,
      llm_latency_ms,
      db_latency_ms,
      tool_latency_ms,
      success,
      error_message,
      cpu_load_1m,
      memory_rss_mb,
      heap_used_mb,
      metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb)`,
    [
      input.interactionLogId,
      input.routeName,
      input.agentType,
      input.totalLatencyMs ?? null,
      input.llmLatencyMs ?? null,
      input.dbLatencyMs ?? null,
      input.toolLatencyMs ?? null,
      input.success,
      normalizeText(input.errorMessage),
      runtime.cpuLoad1m,
      runtime.memoryRssMb,
      runtime.heapUsedMb,
      JSON.stringify(input.metadata ?? {}),
    ]
  );
}

export async function listAgentDataSourceLogsByInteractionId(interactionLogId: number) {
  await ensureObservabilityDetailTables();

  const result = await hospitalQuery(
    `SELECT *
     FROM agent_data_source_logs
     WHERE interaction_log_id = $1
     ORDER BY created_at ASC, id ASC`,
    [interactionLogId]
  );

  return result.rows as AgentDataSourceLog[];
}

export async function listAgentPerformanceLogsByInteractionId(interactionLogId: number) {
  await ensureObservabilityDetailTables();

  const result = await hospitalQuery(
    `SELECT *
     FROM agent_performance_logs
     WHERE interaction_log_id = $1
     ORDER BY created_at ASC, id ASC`,
    [interactionLogId]
  );

  return result.rows as AgentPerformanceLog[];
}
