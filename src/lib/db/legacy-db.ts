// This file contains the legacy database connection and should not be used for new clinical workflows.
// New clinical workflows must use hospital_cs through hospital-db.ts.
import { Pool } from 'pg';

// Inisialisasi Pool koneksi
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
});

// Fungsi pembantu untuk menjalankan query
export const query = (text: string, params?: unknown[]) => pool.query(text, params);
