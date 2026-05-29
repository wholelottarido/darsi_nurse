import { hospitalQuery } from './hospital-db';

export async function getHospitalPatients(limit = 50) {
  const sql = `
    SELECT
      id,
      user_id,
      no_rm,
      full_name,
      email,
      phone,
      date_of_birth,
      address,
      ktp_number,
      medical_record,
      insurance_type,
      verified_at,
      created_at,
      updated_at,
      source
    FROM patients
    ORDER BY created_at DESC
    LIMIT $1
  `;

  const res = await hospitalQuery(sql, [limit]);
  return res.rows;
}

export async function getHospitalPatientsByPerawatUsername(username: string, limit = 50) {
  const sql = `
    SELECT DISTINCT ON (p.id)
      p.id,
      p.user_id,
      p.no_rm,
      p.full_name,
      p.email,
      p.phone,
      p.date_of_birth,
      p.address,
      p.ktp_number,
      p.medical_record,
      p.insurance_type,
      p.verified_at,
      p.created_at,
      p.updated_at,
      p.source
    FROM patients p
    INNER JOIN registrations r ON r.patient_id = p.id
    INNER JOIN indirect_staff_nurses n ON n.id = r.nurse_id
    WHERE LOWER(n.username) = LOWER($1)
    ORDER BY p.id, COALESCE(r.updated_at, r.created_at) DESC, p.created_at DESC
    LIMIT $2
  `;

  const res = await hospitalQuery(sql, [username, limit]);
  return res.rows;
}
