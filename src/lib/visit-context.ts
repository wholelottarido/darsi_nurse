import { hospitalQuery } from "./hospital-db";
import { getCurrentPerawat } from "./nurse-auth";

export type VisitContext = {
  patientId: number;
  registrationId: number | null;
  triageVisitId: number | null;
  nurseId: number | null;
};

export type VisitSummary = {
  triageVisitId: number;
  registrationId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
  source: "bootstrap" | "manual";
  isActive: boolean;
};

type TriageVisitRow = {
  id: number;
  registration_id?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  source?: "bootstrap" | "manual" | null;
};

export async function resolveNurseId() {
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

export async function ensureVisitInfrastructure() {
  await hospitalQuery(`
    CREATE TABLE IF NOT EXISTS triage_visits (
      id SERIAL PRIMARY KEY,
      patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
      registration_id INTEGER REFERENCES registrations(id) ON DELETE CASCADE,
      nurse_id INTEGER NOT NULL REFERENCES indirect_staff_nurses(id) ON DELETE CASCADE,
      source VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source IN ('bootstrap', 'manual')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await hospitalQuery(`
    CREATE INDEX IF NOT EXISTS idx_triage_visits_patient_nurse_created
    ON triage_visits(patient_id, nurse_id, created_at DESC, id DESC);
  `);

  await hospitalQuery(`
    CREATE INDEX IF NOT EXISTS idx_triage_visits_registration_id
    ON triage_visits(registration_id);
  `);

  await hospitalQuery(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_triage_visits_bootstrap_registration
    ON triage_visits(patient_id, nurse_id, registration_id, source)
    WHERE source = 'bootstrap';
  `);

  await hospitalQuery(`
    ALTER TABLE clinical_notes
    ADD COLUMN IF NOT EXISTS triage_visit_id INTEGER REFERENCES triage_visits(id) ON DELETE SET NULL;
  `);

  await hospitalQuery(`
    CREATE INDEX IF NOT EXISTS idx_clinical_notes_triage_visit_id
    ON clinical_notes(triage_visit_id, created_at DESC);
  `);

  const conversationTable = await hospitalQuery(
    `SELECT to_regclass('public.conversations') AS table_name`
  );

  if (conversationTable.rows[0]?.table_name) {
    await hospitalQuery(`
      ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS triage_visit_id INTEGER REFERENCES triage_visits(id) ON DELETE SET NULL;
    `);

    await hospitalQuery(`
      CREATE INDEX IF NOT EXISTS idx_conversations_triage_visit_id
      ON conversations(triage_visit_id, created_at ASC);
    `);
  }
}

async function resolveActiveRegistrationId(patientId: number, nurseId: number) {
  const registrationResult = await hospitalQuery(
    `SELECT id
     FROM registrations
     WHERE patient_id = $1 AND (nurse_id = $2 OR nurse_id IS NULL)
     ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
     LIMIT 1`,
    [patientId, nurseId]
  );

  return (registrationResult.rows[0]?.id as number | undefined) ?? null;
}

async function ensureBootstrapVisits(patientId: number, nurseId: number) {
  await ensureVisitInfrastructure();

  await hospitalQuery(
    `INSERT INTO triage_visits (patient_id, registration_id, nurse_id, source, created_at, updated_at)
     SELECT r.patient_id,
            r.id,
            $2,
            'bootstrap',
            COALESCE(r.created_at, CURRENT_TIMESTAMP),
            COALESCE(r.updated_at, r.created_at, CURRENT_TIMESTAMP)
     FROM registrations r
     WHERE r.patient_id = $1
       AND (r.nurse_id = $2 OR r.nurse_id IS NULL)
       AND NOT EXISTS (
         SELECT 1
         FROM triage_visits tv
         WHERE tv.patient_id = r.patient_id
           AND tv.nurse_id = $2
           AND tv.registration_id = r.id
           AND tv.source = 'bootstrap'
       )`,
    [patientId, nurseId]
  );

  await hospitalQuery(
    `UPDATE clinical_notes cn
     SET triage_visit_id = tv.id
     FROM triage_visits tv
     WHERE cn.patient_id = $1
       AND cn.triage_visit_id IS NULL
       AND cn.evidence_refs->>'registration_id' = tv.registration_id::text
       AND tv.patient_id = cn.patient_id
       AND tv.nurse_id = $2
       AND tv.source = 'bootstrap'`,
    [patientId, nurseId]
  );

  const conversationTable = await hospitalQuery(
    `SELECT to_regclass('public.conversations') AS table_name`
  );

  if (conversationTable.rows[0]?.table_name) {
    await hospitalQuery(
      `UPDATE conversations c
       SET triage_visit_id = tv.id
       FROM triage_visits tv
       WHERE c.patient_id = $1
         AND c.triage_visit_id IS NULL
         AND c.registration_id = tv.registration_id
         AND tv.patient_id = c.patient_id
         AND tv.nurse_id = $2
         AND tv.source = 'bootstrap'`,
      [patientId, nurseId]
    );
  }
}

async function createBootstrapVisitIfMissing(patientId: number, nurseId: number, registrationId: number | null) {
  if (!registrationId) {
    return null;
  }

  await ensureVisitInfrastructure();

  const existing = await hospitalQuery(
    `SELECT id, registration_id, created_at, updated_at, source
     FROM triage_visits
     WHERE patient_id = $1
       AND nurse_id = $2
       AND registration_id = $3
       AND source = 'bootstrap'
     LIMIT 1`,
    [patientId, nurseId, registrationId]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0] as TriageVisitRow;
  }

  const inserted = await hospitalQuery(
    `INSERT INTO triage_visits (patient_id, registration_id, nurse_id, source)
     VALUES ($1, $2, $3, 'bootstrap')
     RETURNING id, registration_id, created_at, updated_at, source`,
    [patientId, registrationId, nurseId]
  );

  return inserted.rows[0] as TriageVisitRow;
}

export async function createTriageVisit(patientId: number): Promise<VisitSummary> {
  const nurseId = await resolveNurseId();
  if (!nurseId) {
    throw new Error("Unauthorized");
  }

  await ensureBootstrapVisits(patientId, nurseId);
  const registrationId = await resolveActiveRegistrationId(patientId, nurseId);

  const result = await hospitalQuery(
    `INSERT INTO triage_visits (patient_id, registration_id, nurse_id, source)
     VALUES ($1, $2, $3, 'manual')
     RETURNING id, registration_id, created_at, updated_at, source`,
    [patientId, registrationId, nurseId]
  );

  const row = result.rows[0] as TriageVisitRow;
  return {
    triageVisitId: row.id,
    registrationId: row.registration_id ?? null,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    source: row.source === 'bootstrap' ? 'bootstrap' : 'manual',
    isActive: true,
  };
}

export async function resolveVisitContext(patientId: number, preferredTriageVisitId?: number | null): Promise<VisitContext> {
  const nurseId = await resolveNurseId();
  if (!nurseId) {
    return {
      patientId,
      registrationId: null,
      triageVisitId: null,
      nurseId: null,
    };
  }

  await ensureBootstrapVisits(patientId, nurseId);

  if (preferredTriageVisitId) {
    const preferredResult = await hospitalQuery(
      `SELECT id, registration_id
       FROM triage_visits
       WHERE id = $1 AND patient_id = $2 AND nurse_id = $3
       LIMIT 1`,
      [preferredTriageVisitId, patientId, nurseId]
    );

    if (preferredResult.rows.length > 0) {
      return {
        patientId,
        nurseId,
        triageVisitId: preferredTriageVisitId,
        registrationId: (preferredResult.rows[0].registration_id as number | undefined) ?? null,
      };
    }
  }

  const triageVisitResult = await hospitalQuery(
    `SELECT id, registration_id
     FROM triage_visits
     WHERE patient_id = $1 AND nurse_id = $2
     ORDER BY COALESCE(updated_at, created_at) DESC, id DESC
     LIMIT 1`,
    [patientId, nurseId]
  );

  if (triageVisitResult.rows.length > 0) {
    return {
      patientId,
      nurseId,
      triageVisitId: triageVisitResult.rows[0].id as number,
      registrationId: (triageVisitResult.rows[0].registration_id as number | undefined) ?? null,
    };
  }

  const registrationId = await resolveActiveRegistrationId(patientId, nurseId);
  const bootstrap = await createBootstrapVisitIfMissing(patientId, nurseId, registrationId);

  return {
    patientId,
    nurseId,
    triageVisitId: bootstrap?.id ?? null,
    registrationId: bootstrap?.registration_id ?? registrationId,
  };
}

export async function listVisitSummaries(patientId: number): Promise<VisitSummary[]> {
  const nurseId = await resolveNurseId();
  if (!nurseId) {
    return [];
  }

  await ensureBootstrapVisits(patientId, nurseId);

  const result = await hospitalQuery(
    `SELECT id, registration_id, created_at, updated_at, source
     FROM triage_visits
     WHERE patient_id = $1 AND nurse_id = $2
     ORDER BY COALESCE(updated_at, created_at) DESC, id DESC`,
    [patientId, nurseId]
  );

  return result.rows.map((row, index) => ({
    triageVisitId: row.id as number,
    registrationId: (row.registration_id as number | undefined) ?? null,
    createdAt: typeof row.created_at === "string" ? row.created_at : null,
    updatedAt: typeof row.updated_at === "string" ? row.updated_at : null,
    source: row.source === 'bootstrap' ? 'bootstrap' : 'manual',
    isActive: index === 0,
  }));
}
