import { Pool } from "pg";

const connectionString = process.env.HOSPITAL_CS_DATABASE_URL;

if (!connectionString) {
  throw new Error("HOSPITAL_CS_DATABASE_URL belum dikonfigurasi.");
}

const globalForHospitalDb = globalThis as unknown as {
  hospitalDbPool?: Pool;
};

const pool =
  globalForHospitalDb.hospitalDbPool ??
  new Pool({
    connectionString,
    connectionTimeoutMillis: 10000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForHospitalDb.hospitalDbPool = pool;
}

export const hospitalQuery = (text: string, params?: unknown[]) =>
  pool.query(text, params);
