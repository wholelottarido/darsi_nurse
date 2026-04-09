import { query } from './db';

export async function updatePatientMedis(patientId: string, data: any) {
  const { 
    berat_badan, tinggi_badan, 
    gol_darah, alergi, riwayat_penyakit 
  } = data;

  try {
    const result = await query(
      `UPDATE medis_pasien 
       SET berat_badan = $2, tinggi_badan = $3, gol_darah = $4, 
           alergi = $5, riwayat_penyakit = $6, diperbarui_pada = NOW()
       WHERE id_pasien = $1 RETURNING *`,
      [patientId, berat_badan, tinggi_badan, gol_darah, alergi, riwayat_penyakit]
    );
    
    if (result.rows.length === 0) {
      throw new Error('Data medis pasien tidak ditemukan');
    }
    
    console.log('✅ Data medis pasien berhasil diperbarui:', patientId);
    return result.rows[0];
  } catch (error: any) {
    console.error('❌ Error di updatePatientMedis:', error.message);
    throw error;
  }
}
