const { Client } = require('pg');

async function checkConversations() {
  const client = new Client({
    host: '10.9.23.205',
    port: 5435,
    database: 'darsi_nurse',
    user: 'ridho',
    password: 'labduafa'
  });
  
  try {
    await client.connect();
    console.log('✅ Connected');
    
    const patientId = '7811d0b7-e1ed-4c74-940f-549e71d93612';
    
    // Count conversations
    const countResult = await client.query(
      'SELECT COUNT(*) as count FROM conversations WHERE patient_id = $1',
      [patientId]
    );
    
    console.log(`\n📊 Conversations count: ${countResult.rows[0].count}`);
    
    // Show last 3 conversations
    const result = await client.query(
      `SELECT id, role, message, created_at FROM conversations 
       WHERE patient_id = $1 
       ORDER BY created_at DESC 
       LIMIT 3`,
      [patientId]
    );
    
    console.log('\n📋 Last 3 conversations:');
    result.rows.forEach((row, idx) => {
      console.log(`\n[${idx+1}] Role: ${row.role} | Created: ${row.created_at}`);
      console.log(`Message: ${row.message.substring(0, 100)}...`);
    });
    
    // Delete old conversations
    console.log('\n🗑️ Clearing all conversations for this patient...');
    const deleteResult = await client.query(
      'DELETE FROM conversations WHERE patient_id = $1',
      [patientId]
    );
    
    console.log(`✅ Deleted ${deleteResult.rowCount} conversations`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkConversations();
