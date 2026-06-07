import { Client } from 'pg';

const client = new Client({
  connectionString: 'postgresql://ridho:labduafa@10.9.23.205:5435/darsi_nurse',
});

try {
  await client.connect();
  
  const patientId = 'cfe789fc-d478-480c-b68c-0d6991b52a94';
  
  console.log('🔍 Fetching patient data from database...\n');
  
  const patientResult = await client.query(
    `SELECT id, nama, usia, tanggal_lahir, jenis_kelamin, created_at FROM pasien WHERE id = $1`,
    [patientId]
  );
  
  console.log('📌 PATIENT INFO:');
  console.log(JSON.stringify(patientResult.rows[0], null, 2));
  
  const medisResult = await client.query(
    `SELECT id_pasien, nomor_rekam_medis, berat_badan, tinggi_badan, 
            gol_darah, alergi, riwayat_penyakit, diperbarui_pada 
     FROM medis_pasien WHERE id_pasien = $1`,
    [patientId]
  );
  
  console.log('\n📋 MEDICAL DATA:');
  console.log(JSON.stringify(medisResult.rows[0], null, 2));
  
  // Calculate BMI
  const medis = medisResult.rows[0] || {};
  let bmi = null;
  if (medis.berat_badan && medis.tinggi_badan) {
    const heightM = medis.tinggi_badan / 100;
    bmi = (medis.berat_badan / (heightM * heightM)).toFixed(1);
  }
  
  console.log('\n✅ TOOL RESPONSE FORMAT (what agent would get):');
  console.log(JSON.stringify({
    success: true,
    patient: {
      ...patientResult.rows[0],
      ...medis,
      bmi,
    },
  }, null, 2));
  
  await client.end();
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}
