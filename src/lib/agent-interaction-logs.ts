import { hospitalQuery } from "@/lib/hospital-db";

export type AgentInteractionLog = {
  id: number;
  created_at: string;
  route_name: string;
  agent_type: string;
  request_kind: string | null;
  nurse_id: string | null;
  nurse_username: string | null;
  nurse_name: string | null;
  patient_id: number | null;
  patient_name: string | null;
  patient_no_rm: string | null;
  registration_id: number | null;
  triage_visit_id: number | null;
  session_id: number | null;
  intent: string | null;
  delegated_agents: string[];
  tools_used: string[];
  request_message: string | null;
  response_message: string | null;
  success: boolean;
  error_message: string | null;
  latency_ms: number | null;
  metadata: Record<string, unknown> | null;
};

export type SaveAgentInteractionLogInput = {
  routeName: string;
  agentType: string;
  requestKind?: string | null;
  nurseId?: string | null;
  nurseUsername?: string | null;
  nurseName?: string | null;
  patientId?: number | null;
  patientName?: string | null;
  patientNoRm?: string | null;
  registrationId?: number | null;
  triageVisitId?: number | null;
  sessionId?: number | null;
  intent?: string | null;
  delegatedAgents?: string[];
  toolsUsed?: string[];
  requestMessage?: string | null;
  responseMessage?: string | null;
  success: boolean;
  errorMessage?: string | null;
  latencyMs?: number | null;
  metadata?: Record<string, unknown> | null;
};

type NurseSnapshot = {
  id: string;
  username: string | null;
  nama_lengkap: string | null;
};

type PatientSnapshot = {
  id: number;
  full_name: string | null;
  no_rm: string | null;
};

const globalForAgentInteractionLogs = globalThis as typeof globalThis & {
  __agentInteractionLogsReady?: Promise<void>;
};

async function ensureAgentInteractionLogsTable() {
  if (!globalForAgentInteractionLogs.__agentInteractionLogsReady) {
    globalForAgentInteractionLogs.__agentInteractionLogsReady = (async () => {
      await hospitalQuery(`
        CREATE TABLE IF NOT EXISTS agent_interaction_logs (
          id BIGSERIAL PRIMARY KEY,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          route_name TEXT NOT NULL,
          agent_type TEXT NOT NULL,
          request_kind TEXT,
          nurse_id UUID,
          nurse_username TEXT,
          nurse_name TEXT,
          patient_id INTEGER,
          patient_name TEXT,
          patient_no_rm TEXT,
          registration_id INTEGER,
          triage_visit_id INTEGER,
          session_id BIGINT,
          intent TEXT,
          delegated_agents JSONB NOT NULL DEFAULT '[]'::jsonb,
          tools_used JSONB NOT NULL DEFAULT '[]'::jsonb,
          request_message TEXT,
          response_message TEXT,
          success BOOLEAN NOT NULL DEFAULT TRUE,
          error_message TEXT,
          latency_ms INTEGER,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb
        )
      `);
      await hospitalQuery(
        `CREATE INDEX IF NOT EXISTS idx_agent_interaction_logs_created_at ON agent_interaction_logs(created_at DESC)`
      );
      await hospitalQuery(
        `CREATE INDEX IF NOT EXISTS idx_agent_interaction_logs_route_name ON agent_interaction_logs(route_name)`
      );
      await hospitalQuery(
        `CREATE INDEX IF NOT EXISTS idx_agent_interaction_logs_nurse_id ON agent_interaction_logs(nurse_id)`
      );
      await hospitalQuery(
        `CREATE INDEX IF NOT EXISTS idx_agent_interaction_logs_patient_id ON agent_interaction_logs(patient_id)`
      );
      await hospitalQuery(
        `CREATE INDEX IF NOT EXISTS idx_agent_interaction_logs_success ON agent_interaction_logs(success)`
      );
    })().catch((error) => {
      globalForAgentInteractionLogs.__agentInteractionLogsReady = undefined;
      throw error;
    });
  }

  await globalForAgentInteractionLogs.__agentInteractionLogsReady;
}

async function resolveNurseSnapshot(input: SaveAgentInteractionLogInput): Promise<NurseSnapshot | null> {
  if (!input.nurseId) {
    return null;
  }

  if (input.nurseUsername || input.nurseName) {
    return {
      id: input.nurseId,
      username: input.nurseUsername ?? null,
      nama_lengkap: input.nurseName ?? null,
    };
  }

  const result = await hospitalQuery(
    `SELECT id, username, nama_lengkap
     FROM perawat
     WHERE id = $1
     LIMIT 1`,
    [input.nurseId]
  );

  return (result.rows[0] as NurseSnapshot | undefined) ?? null;
}

async function resolvePatientSnapshot(input: SaveAgentInteractionLogInput): Promise<PatientSnapshot | null> {
  if (!Number.isFinite(Number(input.patientId))) {
    return null;
  }

  if (input.patientName || input.patientNoRm) {
    return {
      id: Number(input.patientId),
      full_name: input.patientName ?? null,
      no_rm: input.patientNoRm ?? null,
    };
  }

  const result = await hospitalQuery(
    `SELECT id, full_name, no_rm
     FROM patients
     WHERE id = $1
     LIMIT 1`,
    [Number(input.patientId)]
  );

  return (result.rows[0] as PatientSnapshot | undefined) ?? null;
}

function normalizeText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeStringArray(value?: string[] | null) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((item) => String(item).trim())
    .filter(Boolean);
}

export async function saveAgentInteractionLog(input: SaveAgentInteractionLogInput): Promise<Pick<AgentInteractionLog, "id" | "created_at">> {
  await ensureAgentInteractionLogsTable();

  const [nurseSnapshot, patientSnapshot] = await Promise.all([
    resolveNurseSnapshot(input),
    resolvePatientSnapshot(input),
  ]);

  const result = await hospitalQuery(
    `INSERT INTO agent_interaction_logs (
      route_name,
      agent_type,
      request_kind,
      nurse_id,
      nurse_username,
      nurse_name,
      patient_id,
      patient_name,
      patient_no_rm,
      registration_id,
      triage_visit_id,
      session_id,
      intent,
      delegated_agents,
      tools_used,
      request_message,
      response_message,
      success,
      error_message,
      latency_ms,
      metadata
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
      $11, $12, $13, $14::jsonb, $15::jsonb, $16, $17, $18, $19, $20, $21::jsonb
    )
    RETURNING id, created_at`,
    [
      input.routeName,
      input.agentType,
      normalizeText(input.requestKind),
      nurseSnapshot?.id ?? input.nurseId ?? null,
      nurseSnapshot?.username ?? input.nurseUsername ?? null,
      nurseSnapshot?.nama_lengkap ?? input.nurseName ?? null,
      patientSnapshot?.id ?? (input.patientId ?? null),
      patientSnapshot?.full_name ?? input.patientName ?? null,
      patientSnapshot?.no_rm ?? input.patientNoRm ?? null,
      input.registrationId ?? null,
      input.triageVisitId ?? null,
      input.sessionId ?? null,
      normalizeText(input.intent),
      JSON.stringify(normalizeStringArray(input.delegatedAgents)),
      JSON.stringify(normalizeStringArray(input.toolsUsed)),
      normalizeText(input.requestMessage),
      normalizeText(input.responseMessage),
      input.success,
      normalizeText(input.errorMessage),
      input.latencyMs ?? null,
      JSON.stringify(input.metadata ?? {}),
    ]
  );

  return result.rows[0] as Pick<AgentInteractionLog, "id" | "created_at">;
}

export async function getAgentInteractionLogById(id: number): Promise<AgentInteractionLog | null> {
  await ensureAgentInteractionLogsTable();

  const result = await hospitalQuery(
    `SELECT *
     FROM agent_interaction_logs
     WHERE id = $1
     LIMIT 1`,
    [id]
  );

  return (result.rows[0] as AgentInteractionLog | undefined) ?? null;
}

export async function listAgentInteractionLogs(limit = 100): Promise<AgentInteractionLog[]> {
  await ensureAgentInteractionLogsTable();

  const boundedLimit = Math.max(1, Math.min(500, limit));
  const result = await hospitalQuery(
    `SELECT *
     FROM agent_interaction_logs
     ORDER BY created_at DESC, id DESC
     LIMIT $1`,
    [boundedLimit]
  );

  return result.rows as AgentInteractionLog[];
}
