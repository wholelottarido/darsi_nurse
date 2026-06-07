const { Client } = require('pg');

async function checkIcd() {
  const client = new Client({
    host: '10.9.23.205',
    port: 5435,
    database: 'darsi_nurse',
    user: 'ridho',
    password: 'labduafa'
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
      
      // Show sample data
      const sampleResult = await client.query('SELECT code, name_id, name_en FROM icds LIMIT 3');
      console.log('\n📋 Sample ICD data:');
      sampleResult.rows.forEach(row => {
        console.log(`  - ${row.code}: ${row.name_id}`);
      });
      
      // Test search with "demam"
      console.log('\n🔍 Testing search with "demam":');
      const result = await client.query(
        `SELECT code, name_id, name_en FROM icds 
         WHERE LOWER(name_id) LIKE $1 OR LOWER(name_en) LIKE $1
         LIMIT 5`,
        ['%demam%']
      );
      
      console.log(`Found ${result.rows.length} results:`);
      result.rows.forEach(row => {
        console.log(`  - ${row.code}: ${row.name_id}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkIcd();
