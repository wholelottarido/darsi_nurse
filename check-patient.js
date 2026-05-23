const { Client } = require('pg');

async function checkPatient() {
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
    
    const patientId = '7811d0b7-e1ed-4c74-940f-549e71d93612';
    
    // Check pasien table
    console.log('\n📋 Checking pasien table:');
    const pasienResult = await client.query(
      'SELECT id, nama, usia, tanggal_lahir, jenis_kelamin FROM pasien WHERE id = $1',
      [patientId]
    );
    
    if (pasienResult.rows.length > 0) {
      const p = pasienResult.rows[0];
      console.log(`  - ID: ${p.id}`);
      console.log(`  - Nama: ${p.nama}`);
      console.log(`  - Usia: ${p.usia}`);
      console.log(`  - Tanggal lahir: ${p.tanggal_lahir}`);
      console.log(`  - Jenis kelamin: ${p.jenis_kelamin}`);
    } else {
      console.log('  ❌ Patient not found in pasien table');
    }
    
    // Check medis_pasien table
    console.log('\n📋 Checking medis_pasien table:');
    const medisResult = await client.query(
      'SELECT id_pasien, nomor_rekam_medis, berat_badan, tinggi_badan, gol_darah, alergi, riwayat_penyakit FROM medis_pasien WHERE id_pasien = $1',
      [patientId]
    );
    
    if (medisResult.rows.length > 0) {
      const m = medisResult.rows[0];
      console.log(`  - ID Pasien: ${m.id_pasien}`);
      console.log(`  - Nomor Rekam Medis: ${m.nomor_rekam_medis}`);
      console.log(`  - Berat Badan: ${m.berat_badan}`);
      console.log(`  - Tinggi Badan: ${m.tinggi_badan}`);
      console.log(`  - Golongan Darah: ${m.gol_darah}`);
      console.log(`  - Alergi: ${m.alergi}`);
      console.log(`  - Riwayat Penyakit: ${m.riwayat_penyakit}`);
    } else {
      console.log('  ❌ Patient not found in medis_pasien table');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await client.end();
  }
}

checkPatient();
