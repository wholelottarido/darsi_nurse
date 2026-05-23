const { Client } = require('pg');

const connectionString = 'postgresql://ridho:labduafa@10.9.23.205:5435/darsi_nurse';

async function setupConversationsTable() {
  const client = new Client({
    connectionString: connectionString,
    connect_timeout: 10,
  });

  try {
    console.log('🔌 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected successfully!');

    // Check existing tables
    const checkTable = await client.query(
      "SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'conversations')"
    );
    
    if (checkTable.rows[0].exists) {
      console.log('⚠️  Table "conversations" already exists. Skipping creation.');
      return;
    }

    console.log('📝 Creating "conversations" table...');
    await client.query(`
      CREATE TABLE conversations (
        id SERIAL PRIMARY KEY,
        patient_id INT NOT NULL REFERENCES pasien(id) ON DELETE CASCADE,
        role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'agent')),
        message TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "conversations" created successfully!');

    console.log('📑 Creating indexes...');
    await client.query(`
      CREATE INDEX idx_conversations_patient_id ON conversations(patient_id);
    `);
    console.log('✅ Index idx_conversations_patient_id created!');

    await client.query(`
      CREATE INDEX idx_conversations_created_at ON conversations(created_at DESC);
    `);
    console.log('✅ Index idx_conversations_created_at created!');

    // Verify
    const result = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_name = 'conversations'"
    );
    console.log('\n✨ Setup complete! Table info:');
    console.log(result.rows);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code) {
      console.error('   Error Code:', error.code);
    }
    process.exit(1);
  } finally {
    console.log('🔌 Closing connection...');
    await client.end();
    console.log('✅ Connection closed.');
  }
}

setupConversationsTable();
