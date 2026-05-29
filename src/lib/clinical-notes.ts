import { hospitalQuery } from "@/lib/hospital-db";

export type ClinicalNote = {
  id: number;
  patient_id: number;
  doctor_id?: number | null;
  source: "chat" | "clinical_summary" | "external_examinations" | "nurse_check";
  status: "draft" | "final";
  summary?: string | null;
  assessment?: string | null;
  plan?: string | null;
  medication_recommendation?: string | null;
  triage_level?: string | null;
  evidence_refs?: Record<string, unknown> | null;
  doctor_read_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type ClinicalNoteInput = {
  patientId: number;
  doctorId?: number | null;
  source: ClinicalNote["source"];
  status?: ClinicalNote["status"];
  summary?: string | null;
  assessment?: string | null;
  plan?: string | null;
  medicationRecommendation?: string | null;
  triageLevel?: string | null;
  evidenceRefs?: Record<string, unknown> | null;
  doctorReadAt?: string | null;
};

export async function createClinicalNote(input: ClinicalNoteInput) {
  const result = await hospitalQuery(
    `INSERT INTO clinical_notes (
      patient_id,
      doctor_id,
      source,
      status,
      summary,
      assessment,
      plan,
      medication_recommendation,
      triage_level,
      evidence_refs,
      doctor_read_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
    [
      input.patientId,
      input.doctorId ?? null,
      input.source,
      input.status ?? "draft",
      input.summary ?? null,
      input.assessment ?? null,
      input.plan ?? null,
      input.medicationRecommendation ?? null,
      input.triageLevel ?? null,
      input.evidenceRefs ?? null,
      input.doctorReadAt ?? null,
    ]
  );

  return result.rows[0] as ClinicalNote;
}

export async function getLatestClinicalNote(patientId: number, nurseId?: number) {
  if (nurseId) {
    const result = await hospitalQuery(
      `SELECT *
       FROM clinical_notes
       WHERE patient_id = $1 AND evidence_refs->>'nurse_id' = $2
       ORDER BY created_at DESC
       LIMIT 1`,
      [patientId, String(nurseId)]
    );

    return (result.rows[0] as ClinicalNote) ?? null;
  }

  const result = await hospitalQuery(
    `SELECT *
     FROM clinical_notes
     WHERE patient_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [patientId]
  );

  return (result.rows[0] as ClinicalNote) ?? null;
}

export async function listClinicalNotes(patientId: number, limit: number = 10, nurseId?: number) {
  if (nurseId) {
    const result = await hospitalQuery(
      `SELECT *
       FROM clinical_notes
       WHERE patient_id = $1 AND evidence_refs->>'nurse_id' = $3
       ORDER BY created_at DESC
       LIMIT $2`,
      [patientId, limit, String(nurseId)]
    );

    return result.rows as ClinicalNote[];
  }

  const result = await hospitalQuery(
    `SELECT *
     FROM clinical_notes
     WHERE patient_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [patientId, limit]
  );

  return result.rows as ClinicalNote[];
}
