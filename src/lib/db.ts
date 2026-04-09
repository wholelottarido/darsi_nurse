import { Pool } from 'pg';

// Inisialisasi Pool koneksi
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Fungsi pembantu untuk menjalankan query
export const query = (text: string, params?: any[]) => pool.query(text, params);