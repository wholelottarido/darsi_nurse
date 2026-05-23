import pkg from 'pg';
const { Client } = pkg;

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://ridho:labduafa@10.9.23.205:5435/darsi_nurse';

async function createConversationsTable() {
  const client = new Client({
    connectionString: DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL');

    // Drop table jika sudah ada (karena tipe data salah)
    await client.query('DROP TABLE IF EXISTS conversations CASCADE;');
    console.log('🗑️  Dropped existing conversations table (if any)');

    // Create table dengan UUID
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
    console.log('✅ Created conversations table');

    // Create indexes
    await client.query(
      'CREATE INDEX idx_conversations_patient_id ON conversations(patient_id);'
    );
    await client.query(
      'CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);'
    );
    console.log('✅ Created indexes');

    // Verify
    const result = await client.query(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_name = 'conversations' 
       ORDER BY ordinal_position;`
    );
    
    console.log('\n📋 Table structure:');
    console.table(result.rows);

    return true;
  } catch (error) {
    console.error('❌ Error:', error.message);
    return false;
  } finally {
    await client.end();
  }
}

createConversationsTable().then(success => {
  process.exit(success ? 0 : 1);
});
