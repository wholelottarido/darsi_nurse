import { hospitalQuery } from "@/lib/db/hospital-db";

export type ClinicalNote = {
  id: number;
  patient_id: number;
  doctor_id?: number | null;
  triage_visit_id?: number | null;
  source: "chat" | "clinical_summary" | "external_examinations" | "nurse_check";
  status: "draft" | "final";
  patient_condition?: string | null;
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
  triageVisitId?: number | null;
  source: ClinicalNote["source"];
  status?: ClinicalNote["status"];
  patientCondition?: string | null;
  summary?: string | null;
  assessment?: string | null;
  plan?: string | null;
  medicationRecommendation?: string | null;
  triageLevel?: string | null;
  evidenceRefs?: Record<string, unknown> | null;
  doctorReadAt?: string | null;
};

function parseEvidenceRefs(value: unknown) {
  if (!value) return null;

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }

  return null;
}

function normalizeClinicalNote(row: Record<string, unknown>) {
  const evidenceRefs = parseEvidenceRefs(row.evidence_refs);
  const patientCondition = typeof row.patient_condition === "string"
    ? row.patient_condition
    : (typeof evidenceRefs?.patient_condition === "string" ? evidenceRefs.patient_condition : null);

  return {
    ...row,
    patient_condition: patientCondition,
    evidence_refs: evidenceRefs,
  } as ClinicalNote;
}

async function ensureClinicalNotesVisitColumn() {
  // Schema migration is handled separately. Avoid DDL on request-time reads.
}

export async function createClinicalNote(input: ClinicalNoteInput) {
  await ensureClinicalNotesVisitColumn();

  const result = await hospitalQuery(
    `INSERT INTO clinical_notes (
      patient_id,
      doctor_id,
      triage_visit_id,
      source,
      status,
      patient_condition,
      summary,
      assessment,
      plan,
      medication_recommendation,
      triage_level,
      evidence_refs,
      doctor_read_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    RETURNING *`,
    [
      input.patientId,
      input.doctorId ?? null,
      input.triageVisitId ?? null,
      input.source,
      input.status ?? "draft",
      input.patientCondition ?? null,
      input.summary ?? null,
      input.assessment ?? null,
      input.plan ?? null,
      input.medicationRecommendation ?? null,
      input.triageLevel ?? null,
      input.evidenceRefs ?? null,
      input.doctorReadAt ?? null,
    ]
  );

  return normalizeClinicalNote(result.rows[0] as Record<string, unknown>);
}

export async function getLatestClinicalNote(
  patientId: number,
  nurseId?: number,
  registrationId?: number | null,
  triageVisitId?: number | null
) {
  await ensureClinicalNotesVisitColumn();

  if (nurseId) {
    const result = triageVisitId
      ? await hospitalQuery(
          `SELECT *
           FROM clinical_notes
           WHERE patient_id = $1
             AND evidence_refs->>'nurse_id' = $2
             AND triage_visit_id = $3
           ORDER BY created_at DESC, id DESC
           LIMIT 1`,
          [patientId, String(nurseId), triageVisitId]
        )
      : registrationId
        ? await hospitalQuery(
            `SELECT *
             FROM clinical_notes
             WHERE patient_id = $1
               AND evidence_refs->>'nurse_id' = $2
               AND evidence_refs->>'registration_id' = $3
             ORDER BY created_at DESC, id DESC
             LIMIT 1`,
            [patientId, String(nurseId), String(registrationId)]
          )
        : await hospitalQuery(
            `SELECT *
             FROM clinical_notes
             WHERE patient_id = $1 AND evidence_refs->>'nurse_id' = $2
             ORDER BY created_at DESC, id DESC
             LIMIT 1`,
            [patientId, String(nurseId)]
          );

    return result.rows[0]
      ? normalizeClinicalNote(result.rows[0] as Record<string, unknown>)
      : null;
  }

  const result = await hospitalQuery(
    `SELECT *
     FROM clinical_notes
     WHERE patient_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT 1`,
    [patientId]
  );

  return result.rows[0]
    ? normalizeClinicalNote(result.rows[0] as Record<string, unknown>)
    : null;
}

export async function listClinicalNotes(
  patientId: number,
  limit: number = 10,
  nurseId?: number,
  registrationId?: number | null,
  triageVisitId?: number | null
) {
  await ensureClinicalNotesVisitColumn();

  if (nurseId) {
    const result = triageVisitId
      ? await hospitalQuery(
          `SELECT *
           FROM clinical_notes
           WHERE patient_id = $1
             AND evidence_refs->>'nurse_id' = $3
             AND triage_visit_id = $4
           ORDER BY created_at DESC, id DESC
           LIMIT $2`,
          [patientId, limit, String(nurseId), triageVisitId]
        )
      : registrationId
        ? await hospitalQuery(
            `SELECT *
             FROM clinical_notes
             WHERE patient_id = $1
               AND evidence_refs->>'nurse_id' = $3
               AND evidence_refs->>'registration_id' = $4
             ORDER BY created_at DESC, id DESC
             LIMIT $2`,
            [patientId, limit, String(nurseId), String(registrationId)]
          )
        : await hospitalQuery(
            `SELECT *
             FROM clinical_notes
             WHERE patient_id = $1 AND evidence_refs->>'nurse_id' = $3
             ORDER BY created_at DESC, id DESC
             LIMIT $2`,
            [patientId, limit, String(nurseId)]
          );

    return result.rows.map((row) => normalizeClinicalNote(row as Record<string, unknown>));
  }

  const result = await hospitalQuery(
    `SELECT *
     FROM clinical_notes
     WHERE patient_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT $2`,
    [patientId, limit]
  );

  return result.rows.map((row) => normalizeClinicalNote(row as Record<string, unknown>));
}
