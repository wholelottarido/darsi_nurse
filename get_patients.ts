import { query } from './src/lib/db.js';

async function fetchPatients() {
  const res = await query('SELECT p.id, p.nama, m.nomor_rekam_medis, m.alergi, m.riwayat_penyakit FROM pasien p LEFT JOIN medis_pasien m ON p.id = m.id_pasien LIMIT 3');
  console.log(JSON.stringify(res.rows, null, 2));
  process.exit(0);
}
fetchPatients().catch(console.error);
