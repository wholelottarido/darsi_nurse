import { hospitalQuery } from "./hospital-db";
import { getCurrentPerawat } from "./nurse-auth";

export type VisitContext = {
  patientId: number;
  registrationId: number | null;
  nurseId: number | null;
};

export type VisitSummary = {
  registrationId: number;
  createdAt: string | null;
  updatedAt: string | null;
  isActive: boolean;
};

async function resolveNurseId() {
  const perawat = await getCurrentPerawat();
  if (!perawat) {
    return null;
  }

  const nurseResult = await hospitalQuery(
    `SELECT id
     FROM indirect_staff_nurses
     WHERE LOWER(username) = LOWER($1)
    LIMIT 1`,
    [perawat.username]
  );

  return (nurseResult.rows[0]?.id as number | undefined) ?? null;
}

export async function resolveVisitContext(patientId: number, preferredRegistrationId?: number | null): Promise<VisitContext> {
  const nurseId = await resolveNurseId();
  if (!nurseId) {
    return {
      patientId,
      registrationId: null,
      nurseId: null,
    };
  }

  if (preferredRegistrationId) {
    const preferredResult = await hospitalQuery(
      `SELECT id
       FROM registrations
       WHERE id = $1 AND patient_id = $2 AND nurse_id = $3
       LIMIT 1`,
      [preferredRegistrationId, patientId, nurseId]
    );

    if (preferredResult.rows.length > 0) {
      return {
        patientId,
        nurseId,
        registrationId: preferredRegistrationId,
      };
    }
  }

  const registrationResult = await hospitalQuery(
    `SELECT id
     FROM registrations
     WHERE patient_id = $1 AND nurse_id = $2
     ORDER BY COALESCE(updated_at, created_at) DESC
     LIMIT 1`,
    [patientId, nurseId]
  );

  return {
    patientId,
    nurseId,
    registrationId: (registrationResult.rows[0]?.id as number | undefined) ?? null,
  };
}

export async function listVisitSummaries(patientId: number): Promise<VisitSummary[]> {
  const nurseId = await resolveNurseId();
  if (!nurseId) {
    return [];
  }

  const result = await hospitalQuery(
    `SELECT id, created_at, updated_at
     FROM registrations
     WHERE patient_id = $1 AND nurse_id = $2
     ORDER BY COALESCE(updated_at, created_at) DESC, id DESC`,
    [patientId, nurseId]
  );

  return result.rows.map((row, index) => ({
    registrationId: row.id as number,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    isActive: index === 0,
  }));
}
