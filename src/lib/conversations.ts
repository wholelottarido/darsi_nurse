import { Client } from 'pg';

export async function initializeConversationsTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    console.log('🔌 Connecting to PostgreSQL for initialization...');
    await client.connect();
    console.log('✅ Connected successfully!');

    // Check if table exists
    const checkTable = await client.query(
      "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations')"
    );

    if (checkTable.rows[0].exists) {
      console.log('✅ Table "conversations" already exists.');
      return { success: true, message: 'Table already exists' };
    }

    console.log('📝 Creating "conversations" table...');
    await client.query(`
      CREATE TABLE conversations (
        id SERIAL PRIMARY KEY,
        patient_id UUID NOT NULL REFERENCES pasien(id) ON DELETE CASCADE,
        role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'agent')),
        message TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "conversations" created!');

    console.log('📑 Creating indexes...');
    await client.query(
      'CREATE INDEX idx_conversations_patient_id ON conversations(patient_id);'
    );
    await client.query(
      'CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);'
    );
    console.log('✅ All indexes created!');

    return { success: true, message: 'Table and indexes created successfully' };
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  } finally {
    await client.end();
  }
}

export async function saveConversation(
  patientId: string,
  role: 'user' | 'agent',
  message: string
) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    const result = await client.query(
      'INSERT INTO conversations (patient_id, role, message) VALUES ($1, $2, $3) RETURNING id, created_at;',
      [patientId, role, message]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Error saving conversation:', error);
    throw error;
  } finally {
    await client.end();
  }
}

export async function getConversationHistory(patientId: string, limit: number = 50) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    const result = await client.query(
      'SELECT id, patient_id, role, message, timestamp, created_at FROM conversations WHERE patient_id = $1 ORDER BY created_at ASC LIMIT $2;',
      [patientId, limit]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching conversation history:', error);
    throw error;
  } finally {
    await client.end();
  }
}

export async function clearPatientConversations(patientId: string) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    const result = await client.query(
      'DELETE FROM conversations WHERE patient_id = $1;',
      [patientId]
    );
    return { deleted: result.rowCount };
  } catch (error) {
    console.error('Error clearing conversations:', error);
    throw error;
  } finally {
    await client.end();
  }
}
