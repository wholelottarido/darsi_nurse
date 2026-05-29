import pg from 'pg';

const { Pool } = pg;
const conn = process.env.HOSPITAL_CS_DATABASE_URL;

if (!conn) {
  console.error('HOSPITAL_CS_DATABASE_URL tidak diset. Set environment variable dan jalankan ulang.');
  process.exit(2);
}

const pool = new Pool({ connectionString: conn, connectionTimeoutMillis: 10000 });

const query = `SELECT * FROM external_examinations LIMIT 50`;

(async () => {
  try {
    const res = await pool.query(query);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error('ERROR:', err.message || err);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
