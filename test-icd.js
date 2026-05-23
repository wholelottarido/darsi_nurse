const { Client } = require('pg');

async function testIcd() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL || 'postgresql://darsi:darsi123@10.9.23.205:5435/darsi_nurse',
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    const result = await client.query(
      `SELECT code, name_id, name_en FROM icds 
       WHERE name_id ILIKE $1 OR name_en ILIKE $1
       LIMIT 5`,
      ['%demam%']
    );
    
    console.log('✅ ICD search results:', result.rows);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

testIcd();
