import { query } from '@/lib/db/legacy-db';

export async function getAllPatients() {
  const sql = `
    SELECT 
      p.id, p.nama, p.usia, p.tanggal_lahir, p.jenis_kelamin, p.created_at,
      m.nomor_rekam_medis, m.berat_badan, m.tinggi_badan, m.gol_darah, 
      m.alergi, m.riwayat_penyakit, m.diperbarui_pada
    FROM pasien p
    LEFT JOIN medis_pasien m ON p.id = m.id_pasien
    ORDER BY p.created_at DESC
  `;
  const res = await query(sql);
  return res.rows;
}