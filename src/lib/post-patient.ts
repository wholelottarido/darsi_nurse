import { query } from './db';

export async function createPatient(data: any) {
  const { 
    nama, usia, tanggal_lahir, jenis_kelamin, 
    nomor_rekam_medis, berat_badan, tinggi_badan, 
    gol_darah, alergi, riwayat_penyakit 
  } = data;

  console.log('🔍 createPatient - Input data:', {
    nama, usia, tanggal_lahir, jenis_kelamin, nomor_rekam_medis
  });

  try {
    // 1. Simpan ke tabel pasien
    console.log('📝 Inserting ke tabel pasien...');
    const patientRes = await query(
      `INSERT INTO pasien (nama, usia, tanggal_lahir, jenis_kelamin) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [nama, usia, tanggal_lahir, jenis_kelamin]
    );

    const patientId = patientRes.rows[0].id;
    console.log('✅ Pasien berhasil dibuat dengan ID:', patientId);

    // 2. Simpan ke tabel medis_pasien (Lengkap)
    console.log('📝 Inserting ke tabel medis_pasien...');
    await query(
      `INSERT INTO medis_pasien (
        id_pasien, nomor_rekam_medis, berat_badan, 
        tinggi_badan, gol_darah, alergi, riwayat_penyakit
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        patientId, nomor_rekam_medis, berat_badan, 
        tinggi_badan, gol_darah, alergi, riwayat_penyakit
      ]
    );
    console.log('✅ Medis pasien berhasil disimpan');

    return patientId;
  } catch (error: any) {
    console.error('❌ Error di createPatient:', error.message);
    throw error;
  }
}