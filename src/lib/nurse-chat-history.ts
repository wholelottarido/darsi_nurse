import { hospitalQuery } from "@/lib/hospital-db";

export type StoredNurseChatIntent = "operational" | "general_guidance" | "hybrid" | "out_of_scope";

export type StoredNurseChatSession = {
  id: number;
  nurseId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type StoredNurseChatMessage = {
  id: number;
  sessionId: number;
  nurseId: string;
  role: "user" | "assistant";
  message: string;
  intent: StoredNurseChatIntent | null;
  delegatedAgents: string[];
  toolsUsed: string[];
  createdAt: string;
};

function toIso(value: unknown) {
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function buildSessionTitleFromMessage(message: string) {
  const normalized = message.replace(/\s+/g, " ").trim();
  if (!normalized) return "Chat baru";
  return normalized.length > 60 ? `${normalized.slice(0, 57)}...` : normalized;
}

async function backfillLegacyMessagesIntoSessions() {
  const legacyRows = await hospitalQuery(
    `SELECT DISTINCT nurse_id
     FROM nurse_chat_conversations
     WHERE session_id IS NULL`
  );

  for (const row of legacyRows.rows) {
    const nurseId = String(row.nurse_id);
    const createdRow = await hospitalQuery(
      `INSERT INTO nurse_chat_sessions (nurse_id, title)
       VALUES ($1, $2)
       RETURNING id`,
      [nurseId, "Riwayat sebelumnya"]
    );

    const sessionId = createdRow.rows[0]?.id;
    if (!sessionId) continue;

    await hospitalQuery(
      `UPDATE nurse_chat_conversations
       SET session_id = $1
       WHERE nurse_id = $2 AND session_id IS NULL`,
      [sessionId, nurseId]
    );
  }
}

export async function ensureNurseChatHistoryTable() {
  await hospitalQuery(`
    CREATE TABLE IF NOT EXISTS nurse_chat_sessions (
      id SERIAL PRIMARY KEY,
      nurse_id UUID NOT NULL REFERENCES perawat(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await hospitalQuery(`
    CREATE TABLE IF NOT EXISTS nurse_chat_conversations (
      id SERIAL PRIMARY KEY,
      nurse_id UUID NOT NULL REFERENCES perawat(id) ON DELETE CASCADE,
      session_id INTEGER REFERENCES nurse_chat_sessions(id) ON DELETE CASCADE,
      role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'assistant')),
      message TEXT NOT NULL,
      intent VARCHAR(32),
      delegated_agents JSONB NOT NULL DEFAULT '[]'::jsonb,
      tools_used JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await hospitalQuery(`
    ALTER TABLE nurse_chat_conversations
    ADD COLUMN IF NOT EXISTS session_id INTEGER REFERENCES nurse_chat_sessions(id) ON DELETE CASCADE;
  `);

  await hospitalQuery(`
    CREATE INDEX IF NOT EXISTS idx_nurse_chat_sessions_nurse_id
    ON nurse_chat_sessions(nurse_id);
  `);

  await hospitalQuery(`
    CREATE INDEX IF NOT EXISTS idx_nurse_chat_sessions_nurse_updated_at
    ON nurse_chat_sessions(nurse_id, updated_at DESC, id DESC);
  `);

  await hospitalQuery(`
    CREATE INDEX IF NOT EXISTS idx_nurse_chat_conversations_nurse_id
    ON nurse_chat_conversations(nurse_id);
  `);

  await hospitalQuery(`
    CREATE INDEX IF NOT EXISTS idx_nurse_chat_conversations_session_id
    ON nurse_chat_conversations(session_id);
  `);

  await hospitalQuery(`
    CREATE INDEX IF NOT EXISTS idx_nurse_chat_conversations_session_created_at
    ON nurse_chat_conversations(session_id, created_at ASC, id ASC);
  `);

  await backfillLegacyMessagesIntoSessions();
}

export async function createNurseChatSession(nurseId: string, title = "Chat baru") {
  await ensureNurseChatHistoryTable();

  const result = await hospitalQuery(
    `INSERT INTO nurse_chat_sessions (nurse_id, title)
     VALUES ($1, $2)
     RETURNING id, nurse_id, title, created_at, updated_at`,
    [nurseId, title]
  );

  const row = result.rows[0];
  return {
    id: Number(row.id),
    nurseId: String(row.nurse_id),
    title: row.title,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  } satisfies StoredNurseChatSession;
}

export async function getNurseChatSession(sessionId: number, nurseId: string): Promise<StoredNurseChatSession | null> {
  await ensureNurseChatHistoryTable();

  const result = await hospitalQuery(
    `SELECT id, nurse_id, title, created_at, updated_at
     FROM nurse_chat_sessions
     WHERE id = $1 AND nurse_id = $2
     LIMIT 1`,
    [sessionId, nurseId]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: Number(row.id),
    nurseId: String(row.nurse_id),
    title: row.title,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  };
}

export async function listNurseChatSessions(nurseId: string, limit = 40): Promise<StoredNurseChatSession[]> {
  await ensureNurseChatHistoryTable();

  const result = await hospitalQuery(
    `SELECT id, nurse_id, title, created_at, updated_at
     FROM nurse_chat_sessions
     WHERE nurse_id = $1
     ORDER BY updated_at DESC, id DESC
     LIMIT $2`,
    [nurseId, limit]
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    nurseId: String(row.nurse_id),
    title: row.title,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
  }));
}

export async function updateNurseChatSessionTitle(sessionId: number, title: string) {
  await ensureNurseChatHistoryTable();

  const normalizedTitle = title.trim() || "Chat baru";
  await hospitalQuery(
    `UPDATE nurse_chat_sessions
     SET title = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [sessionId, normalizedTitle]
  );
}

export async function touchNurseChatSession(sessionId: number) {
  await ensureNurseChatHistoryTable();
  await hospitalQuery(
    `UPDATE nurse_chat_sessions
     SET updated_at = CURRENT_TIMESTAMP
     WHERE id = $1`,
    [sessionId]
  );
}

export async function saveNurseChatMessage(input: {
  nurseId: string;
  sessionId: number;
  role: "user" | "assistant";
  message: string;
  intent?: StoredNurseChatIntent | null;
  delegatedAgents?: string[];
  toolsUsed?: string[];
}) {
  await ensureNurseChatHistoryTable();

  const result = await hospitalQuery(
    `INSERT INTO nurse_chat_conversations
      (nurse_id, session_id, role, message, intent, delegated_agents, tools_used)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
     RETURNING id, created_at`,
    [
      input.nurseId,
      input.sessionId,
      input.role,
      input.message,
      input.intent ?? null,
      JSON.stringify(input.delegatedAgents ?? []),
      JSON.stringify(input.toolsUsed ?? []),
    ]
  );

  await touchNurseChatSession(input.sessionId);

  return result.rows[0];
}

export async function getNurseChatHistory(sessionId: number, nurseId: string, limit = 100): Promise<StoredNurseChatMessage[]> {
  await ensureNurseChatHistoryTable();

  const result = await hospitalQuery(
    `SELECT id, session_id, nurse_id, role, message, intent, delegated_agents, tools_used, created_at
     FROM nurse_chat_conversations
     WHERE session_id = $1 AND nurse_id = $2
     ORDER BY created_at ASC, id ASC
     LIMIT $3`,
    [sessionId, nurseId, limit]
  );

  return result.rows.map((row) => ({
    id: Number(row.id),
    sessionId: Number(row.session_id),
    nurseId: String(row.nurse_id),
    role: row.role,
    message: row.message,
    intent: row.intent ?? null,
    delegatedAgents: Array.isArray(row.delegated_agents) ? row.delegated_agents : [],
    toolsUsed: Array.isArray(row.tools_used) ? row.tools_used : [],
    createdAt: toIso(row.created_at),
  }));
}

export async function ensureDefaultNurseChatSession(nurseId: string) {
  const sessions = await listNurseChatSessions(nurseId, 1);
  if (sessions.length > 0) {
    return sessions[0];
  }

  return createNurseChatSession(nurseId, "Chat baru");
}

export { buildSessionTitleFromMessage };
