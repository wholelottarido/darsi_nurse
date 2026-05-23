const { searchIcdDiagnosa } = require('./src/lib/agent-tools');

// Set DATABASE_URL
process.env.DATABASE_URL = 'postgresql://ridho:labduafa@10.9.23.205:5435/darsi_nurse';

async function test() {
  try {
    console.log('🧪 Testing searchIcdDiagnosa');
    const result = await searchIcdDiagnosa('demam', 5);
    
    console.log('\n📤 Result:');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

test();
