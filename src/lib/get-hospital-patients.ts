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
    SELECT
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
      p.source,
      lr.id AS registration_id,
      lr.status AS registration_status,
      lr.tanggal AS registration_date,
      lr.doctor_id AS registration_doctor_id,
      d.full_name AS doctor_full_name,
      d.specialization AS doctor_specialization,
      le.id AS external_examination_id,
      le.doctor_username,
      le.status AS examination_status,
      le.soap_subjective,
      le.soap_objective,
      le.soap_assessment,
      le.soap_plan,
      le.diagnoses,
      le.examination_notes,
      lc.id AS clinical_note_id,
      lc.source AS clinical_note_source,
      lc.patient_condition,
      lc.summary AS clinical_note_summary,
      lc.assessment AS clinical_note_assessment,
      lc.plan AS clinical_note_plan,
      lc.medication_recommendation,
      lc.triage_level,
      lc.created_at AS clinical_note_created_at
    FROM patients p
    INNER JOIN indirect_staff_nurses n
      ON LOWER(n.username) = LOWER($1)
    INNER JOIN LATERAL (
      SELECT r.*
      FROM registrations r
      WHERE r.patient_id = p.id
        AND r.nurse_id = n.id
      ORDER BY COALESCE(r.updated_at, r.created_at) DESC, r.id DESC
      LIMIT 1
    ) lr ON true
    LEFT JOIN indirect_staff_doctors d
      ON d.id = lr.doctor_id
    LEFT JOIN LATERAL (
      SELECT
        ee.id,
        ee.doctor_username,
        ee.status,
        ee.soap_subjective,
        ee.soap_objective,
        ee.soap_assessment,
        ee.soap_plan,
        ee.diagnoses,
        ee.examination_notes
      FROM external_examinations ee
      WHERE ee.registration_id = lr.id
      ORDER BY ee.created_at DESC, ee.id DESC
      LIMIT 1
    ) le ON true
    LEFT JOIN LATERAL (
      SELECT
        cn.id,
        cn.source,
        cn.patient_condition,
        cn.summary,
        cn.assessment,
        cn.plan,
        cn.medication_recommendation,
        cn.triage_level,
        cn.created_at
      FROM clinical_notes cn
      WHERE cn.patient_id = p.id
        AND cn.evidence_refs->>'nurse_id' = n.id::text
        AND cn.evidence_refs->>'registration_id' = lr.id::text
      ORDER BY cn.created_at DESC, cn.id DESC
      LIMIT 1
    ) lc ON true
    ORDER BY COALESCE(lr.updated_at, lr.created_at) DESC, p.created_at DESC
    LIMIT $2
  `;

  const res = await hospitalQuery(sql, [username, limit]);
  return res.rows;
}
