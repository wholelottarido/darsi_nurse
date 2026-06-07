const { Client } = require('pg');

async function checkIcd() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });
  
  try {
    await client.connect();
    console.log('✅ Connected to database');
    
    // Check if icds table exists
    const tableCheck = await client.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'icds')`
    );
    console.log('📊 ICD table exists:', tableCheck.rows[0].exists);
    
    if (tableCheck.rows[0].exists) {
      // Check row count
      const countResult = await client.query('SELECT COUNT(*) as count FROM icds');
      console.log('📈 Total ICD rows:', countResult.rows[0].count);
      
      // Test search with "demam"
      console.log('\n🔍 Testing search with "demam":');
      const result = await client.query(
        `SELECT code, name_id, name_en FROM icds 
         WHERE name_id ILIKE $1 OR name_en ILIKE $1
         LIMIT 5`,
        ['%demam%']
      );
      
      console.log(`Found ${result.rows.length} results:`);
      result.rows.forEach(row => {
        console.log(`  - ${row.code}: ${row.name_id} (${row.name_en})`);
      });
      
      // Test search with "fever"
      console.log('\n🔍 Testing search with "fever":');
      const result2 = await client.query(
        `SELECT code, name_id, name_en FROM icds 
         WHERE name_id ILIKE $1 OR name_en ILIKE $1
         LIMIT 5`,
        ['%fever%']
      );
      console.log(`Found ${result2.rows.length} results`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkIcd();
