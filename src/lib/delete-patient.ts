import { query } from './db';

export async function deletePatient(patientId: string) {
  try {
    // 1. Hapus dari medis_pasien terlebih dahulu (foreign key constraint)
    await query('DELETE FROM medis_pasien WHERE id_pasien = $1', [patientId]);
    
    // 2. Hapus dari pasien
    const result = await query('DELETE FROM pasien WHERE id = $1 RETURNING id', [patientId]);
    
    if (result.rows.length === 0) {
      throw new Error('Pasien tidak ditemukan');
    }
    
    console.log('✅ Pasien berhasil dihapus:', patientId);
    return true;
  } catch (error: any) {
    console.error('❌ Error di deletePatient:', error.message);
    throw error;
  }
}
