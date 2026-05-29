import { Pool } from 'pg';

// Inisialisasi Pool koneksi
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});

// Fungsi pembantu untuk menjalankan query
export const query = (text: string, params?: unknown[]) => pool.query(text, params);
