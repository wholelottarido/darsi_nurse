import { hospitalQuery } from '@/lib/hospital-db';
import { ensureVisitInfrastructure } from '@/lib/visit-context';

type ConversationScope = {
  patientId: number;
  registrationId?: number | null;
  triageVisitId?: number | null;
};

export async function initializeConversationsTable() {
  try {
    console.log('🔌 Ensuring conversations table exists in hospital_cs...');
    await ensureVisitInfrastructure();

    const checkTable = await hospitalQuery(
      "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations')"
    );

    if (checkTable.rows[0].exists) {
      await ensureConversationVisitColumns();
      console.log('✅ Table "conversations" already exists.');
      return { success: true, message: 'Table already exists' };
    }

    console.log('📝 Creating "conversations" table...');
    await hospitalQuery(`
      CREATE TABLE conversations (
        id SERIAL PRIMARY KEY,
        patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        registration_id INTEGER REFERENCES registrations(id) ON DELETE CASCADE,
        triage_visit_id INTEGER REFERENCES triage_visits(id) ON DELETE SET NULL,
        role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'agent')),
        message TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "conversations" created!');

    console.log('📑 Creating indexes...');
    await hospitalQuery('CREATE INDEX idx_conversations_patient_id ON conversations(patient_id);');
    await hospitalQuery('CREATE INDEX idx_conversations_registration_id ON conversations(registration_id);');
    await hospitalQuery('CREATE INDEX idx_conversations_triage_visit_id ON conversations(triage_visit_id);');
    await hospitalQuery('CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);');
    console.log('✅ All indexes created!');

    return { success: true, message: 'Table and indexes created successfully' };
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function ensureConversationVisitColumns() {
  await hospitalQuery(`
    ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS registration_id INTEGER REFERENCES registrations(id) ON DELETE CASCADE;
  `);

  await hospitalQuery(`
    ALTER TABLE conversations
    ADD COLUMN IF NOT EXISTS triage_visit_id INTEGER REFERENCES triage_visits(id) ON DELETE SET NULL;
  `);

  await hospitalQuery(`
    CREATE INDEX IF NOT EXISTS idx_conversations_registration_id
    ON conversations(registration_id);
  `);

  await hospitalQuery(`
    CREATE INDEX IF NOT EXISTS idx_conversations_registration_created_at
    ON conversations(registration_id, created_at ASC);
  `);

  await hospitalQuery(`
    CREATE INDEX IF NOT EXISTS idx_conversations_triage_visit_id
    ON conversations(triage_visit_id);
  `);

  await hospitalQuery(`
    CREATE INDEX IF NOT EXISTS idx_conversations_triage_visit_created_at
    ON conversations(triage_visit_id, created_at ASC);
  `);
}

export async function saveConversation(
  scope: ConversationScope,
  role: 'user' | 'agent',
  message: string
) {
  try {
    await initializeConversationsTable();
    const result = await hospitalQuery(
      'INSERT INTO conversations (patient_id, registration_id, triage_visit_id, role, message) VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at;',
      [scope.patientId, scope.registrationId ?? null, scope.triageVisitId ?? null, role, message]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error saving conversation:', error);
    throw error;
  }
}

export async function getConversationHistory(scope: ConversationScope, limit: number = 50) {
  try {
    await initializeConversationsTable();
    const result = scope.triageVisitId
      ? await hospitalQuery(
          'SELECT id, patient_id, registration_id, triage_visit_id, role, message, timestamp, created_at FROM conversations WHERE triage_visit_id = $1 ORDER BY created_at ASC LIMIT $2;',
          [scope.triageVisitId, limit]
        )
      : scope.registrationId
        ? await hospitalQuery(
            'SELECT id, patient_id, registration_id, triage_visit_id, role, message, timestamp, created_at FROM conversations WHERE registration_id = $1 ORDER BY created_at ASC LIMIT $2;',
            [scope.registrationId, limit]
          )
        : await hospitalQuery(
            'SELECT id, patient_id, registration_id, triage_visit_id, role, message, timestamp, created_at FROM conversations WHERE patient_id = $1 ORDER BY created_at ASC LIMIT $2;',
            [scope.patientId, limit]
          );
    return result.rows;
  } catch (error) {
    console.error('Error fetching conversation history:', error);
    throw error;
  }
}

export async function clearPatientConversations(scope: ConversationScope) {
  try {
    await initializeConversationsTable();
    const result = scope.triageVisitId
      ? await hospitalQuery(
          'DELETE FROM conversations WHERE triage_visit_id = $1;',
          [scope.triageVisitId]
        )
      : scope.registrationId
        ? await hospitalQuery(
            'DELETE FROM conversations WHERE registration_id = $1;',
            [scope.registrationId]
          )
        : await hospitalQuery(
            'DELETE FROM conversations WHERE patient_id = $1;',
            [scope.patientId]
          );
    return { deleted: result.rowCount };
  } catch (error) {
    console.error('Error clearing conversations:', error);
    throw error;
  }
}
