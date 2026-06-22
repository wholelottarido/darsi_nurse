import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const RESULTS_DIR = path.join(PROJECT_ROOT, 'evaluation', 'results');
const PHASE5_DIR = path.join(RESULTS_DIR, 'phase5_structured_clinical_references');
const PHASE5_REFERENCE_DIR = path.join(PHASE5_DIR, 'reference');
const DOTENV_PATH = path.join(PROJECT_ROOT, '.env');
const DEFAULT_LIMIT = 30;

function parseArgs(argv) {
  const args = {
    limit: DEFAULT_LIMIT,
  };

  for (const value of argv) {
    if (value.startsWith('--limit=')) {
      args.limit = Number(value.slice('--limit='.length));
    }
  }

  return args;
}

function normalizeText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function joinNonEmpty(parts, separator = ' ') {
  return parts.map((part) => normalizeText(part)).filter(Boolean).join(separator);
}

function compactParagraph(value) {
  return normalizeText(value).replace(/\s*;\s*/g, '; ');
}

function multilineToSentence(value) {
  const text = String(value ?? '')
    .split(/\r?\n+/)
    .map((line) => normalizeText(line))
    .filter(Boolean)
    .join('; ');
  return text.trim();
}

function escapeCsv(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeLatex(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/&/g, '\\&')
    .replace(/%/g, '\\%')
    .replace(/\$/g, '\\$')
    .replace(/#/g, '\\#')
    .replace(/_/g, '\\_')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/~/g, '\\textasciitilde{}');
}

function formatDate(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

function calculateAge(dateOfBirth) {
  if (!dateOfBirth) {
    return null;
  }

  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) {
    return null;
  }

  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return age;
}

function canonicalizeIcd10Code(code) {
  const cleaned = String(code ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.]/g, '');

  if (!cleaned) {
    return '';
  }

  if (cleaned.includes('.')) {
    return cleaned;
  }

  if (cleaned.length > 3 && /^[A-Z]\d{3,}$/.test(cleaned)) {
    return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
  }

  return cleaned;
}

function normalizeIcd10Code(code) {
  return canonicalizeIcd10Code(code).replace(/\./g, '');
}

function extractIcd10CodesFromText(text) {
  const source = String(text ?? '');
  const matches = [...source.matchAll(/\b([A-TV-Z]\d{2}(?:\.\d{1,4})?|[A-TV-Z]\d{3,4})\b/gi)];
  const seen = new Set();
  const codes = [];

  for (const match of matches) {
    const canonical = canonicalizeIcd10Code(match[1]);
    const normalized = normalizeIcd10Code(canonical);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    codes.push(canonical);
  }

  return codes;
}

function parseJsonSafe(value) {
  if (!value) {
    return null;
  }
  if (typeof value === 'object') {
    return value;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return null;
}

async function loadDotEnvIfNeeded() {
  const neededKeys = ['HOSPITAL_CS_DATABASE_URL', 'DATABASE_URL'];
  if (neededKeys.every((key) => process.env[key])) {
    return;
  }

  try {
    const raw = await fs.readFile(DOTENV_PATH, 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const index = trimmed.indexOf('=');
      if (index === -1) {
        continue;
      }
      const key = trimmed.slice(0, index).trim();
      if (!key || process.env[key]) {
        continue;
      }
      let value = trimmed.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch {
    // rely on env
  }
}

function getDatabaseUrl() {
  return process.env.HOSPITAL_CS_DATABASE_URL || process.env.DATABASE_URL || null;
}

async function connectDatabase() {
  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    throw new Error('HOSPITAL_CS_DATABASE_URL atau DATABASE_URL belum dikonfigurasi.');
  }

  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 10000,
  });

  await client.connect();
  return client;
}

async function ensureOutputDirectories() {
  await fs.mkdir(RESULTS_DIR, { recursive: true });
  await fs.mkdir(PHASE5_DIR, { recursive: true });
  await fs.mkdir(PHASE5_REFERENCE_DIR, { recursive: true });
}

async function writeTextFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

async function copyIfExists(source, destination) {
  try {
    await fs.access(source);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(source, destination);
  } catch {
    // ignore
  }
}

function buildCandidateQuery(limit) {
  return {
    text: `
      WITH candidate_rows AS (
        SELECT
          n.id AS nurse_id,
          n.username AS nurse_username,
          n.full_name AS nurse_full_name,
          n.status AS nurse_status,
          p.id AS patient_id,
          p.no_rm,
          p.full_name AS patient_name,
          p.date_of_birth,
          p.insurance_type,
          p.source AS patient_source,
          r.id AS registration_id,
          r.status AS registration_status,
          r.tanggal AS registration_date,
          r.registration_type,
          r.booking_code,
          r.no_jkn,
          r.kelas_rawat,
          r.created_at AS registration_created_at,
          r.updated_at AS registration_updated_at,
          d.full_name AS doctor_name,
          d.specialization AS doctor_specialization,
          ee.id AS exam_id,
          ee.status AS exam_status,
          ee.soap_subjective,
          ee.soap_objective,
          ee.soap_assessment,
          ee.soap_plan,
          ee.diagnoses,
          ee.examination_notes,
          ee.created_at AS exam_created_at,
          ee.updated_at AS exam_updated_at,
          cn.id AS note_id,
          cn.source AS note_source,
          cn.status AS note_status,
          cn.summary,
          cn.assessment AS note_assessment,
          cn.plan AS note_plan,
          cn.patient_condition,
          cn.medication_recommendation,
          cn.triage_level,
          cn.evidence_refs,
          cn.created_at AS note_created_at,
          cn.updated_at AS note_updated_at,
          ROW_NUMBER() OVER (
            PARTITION BY n.id
            ORDER BY COALESCE(r.updated_at, r.created_at) DESC, r.id DESC
          ) AS nurse_rank
        FROM registrations r
        JOIN patients p ON p.id = r.patient_id
        JOIN indirect_staff_nurses n ON n.id = r.nurse_id
        LEFT JOIN indirect_staff_doctors d ON d.id = r.doctor_id
        LEFT JOIN LATERAL (
          SELECT
            id,
            status,
            soap_subjective,
            soap_objective,
            soap_assessment,
            soap_plan,
            diagnoses,
            examination_notes,
            created_at,
            updated_at
          FROM external_examinations ee
          WHERE ee.registration_id = r.id
          ORDER BY COALESCE(ee.updated_at, ee.created_at) DESC, ee.id DESC
          LIMIT 1
        ) ee ON true
        LEFT JOIN LATERAL (
          SELECT
            id,
            source,
            status,
            summary,
            assessment,
            plan,
            patient_condition,
            medication_recommendation,
            triage_level,
            evidence_refs,
            created_at,
            updated_at
          FROM clinical_notes cn
          WHERE cn.patient_id = p.id
            AND cn.evidence_refs->>'nurse_id' = n.id::text
            AND cn.evidence_refs->>'registration_id' = r.id::text
          ORDER BY cn.created_at DESC, cn.id DESC
          LIMIT 1
        ) cn ON true
        WHERE n.status ILIKE 'on_duty'
          AND ee.id IS NOT NULL
          AND cn.id IS NOT NULL
      )
      SELECT *
      FROM candidate_rows
      WHERE nurse_rank = 1
      ORDER BY nurse_username ASC, registration_id ASC
      LIMIT $1
    `,
    params: [limit],
  };
}

async function loadReferenceCandidates(client, limit) {
  const { text, params } = buildCandidateQuery(limit);
  const result = await client.query(text, params);
  return result.rows;
}

async function loadIcdLookup(client, rows) {
  const codes = new Set();
  for (const row of rows) {
    for (const diagnosis of Array.isArray(row.diagnoses) ? row.diagnoses : []) {
      const raw = diagnosis && typeof diagnosis === 'object' ? (diagnosis.icd_code || diagnosis.code || diagnosis.icdCode) : diagnosis;
      const normalized = normalizeIcd10Code(raw);
      if (normalized) {
        codes.add(normalized);
      }
    }
    const noteRefs = parseJsonSafe(row.evidence_refs);
    if (noteRefs && Array.isArray(noteRefs.icd)) {
      for (const item of noteRefs.icd) {
        const raw = item && typeof item === 'object' ? (item.icd_code || item.code || item.icdCode) : item;
        const normalized = normalizeIcd10Code(raw);
        if (normalized) {
          codes.add(normalized);
        }
      }
    }
    for (const text of [row.soap_assessment, row.examination_notes, row.note_assessment, row.summary].filter(Boolean)) {
      for (const code of extractIcd10CodesFromText(text)) {
        const normalized = normalizeIcd10Code(code);
        if (normalized) {
          codes.add(normalized);
        }
      }
    }
  }

  const icdCodes = [...codes];
  if (icdCodes.length === 0) {
    return new Map();
  }

  const result = await client.query(
    `SELECT code, name
     FROM icd10_diagnoses
     WHERE regexp_replace(UPPER(code), '\\.', '', 'g') = ANY($1::text[])`,
    [icdCodes]
  );

  const lookup = new Map();
  for (const row of result.rows) {
    const canonical = canonicalizeIcd10Code(row.code);
    const normalized = normalizeIcd10Code(row.code);
    const name = normalizeText(row.name);
    if (canonical) {
      lookup.set(canonical, row.name);
    }
    if (normalized) {
      lookup.set(normalized, row.name);
    }
    if (name && canonical) {
      lookup.set(canonical, row.name);
    }
  }

  return lookup;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    const text = normalizeText(value);
    if (text) {
      return text;
    }
  }
  return '';
}

function pickIcd10(row, icdLookup) {
  const rawSources = [];

  for (const diagnosis of Array.isArray(row.diagnoses) ? row.diagnoses : []) {
    rawSources.push({
      code: diagnosis && typeof diagnosis === 'object' ? (diagnosis.icd_code || diagnosis.code || diagnosis.icdCode) : diagnosis,
      name: diagnosis && typeof diagnosis === 'object' ? (diagnosis.icd_name || diagnosis.name || diagnosis.description || diagnosis.icdName) : null,
      source: 'external_examinations.diagnoses',
    });
  }

  const noteRefs = parseJsonSafe(row.evidence_refs);
  if (noteRefs && Array.isArray(noteRefs.icd)) {
    for (const item of noteRefs.icd) {
      rawSources.push({
        code: item && typeof item === 'object' ? (item.icd_code || item.code || item.icdCode) : item,
        name: item && typeof item === 'object' ? (item.icd_name || item.name || item.description || item.icdName) : null,
        source: 'clinical_notes.evidence_refs.icd',
      });
    }
  }

  for (const [source, text] of [
    ['soap_assessment', row.soap_assessment],
    ['examination_notes', row.examination_notes],
    ['note_assessment', row.note_assessment],
    ['summary', row.summary],
  ]) {
    const codes = extractIcd10CodesFromText(text);
    for (const code of codes) {
      rawSources.push({ code, name: null, source });
    }
  }

  for (const item of rawSources) {
    const canonical = canonicalizeIcd10Code(item.code);
    const normalized = normalizeIcd10Code(canonical);
    if (!normalized) {
      continue;
    }
    const lookedUpName = item.name || icdLookup.get(canonical) || icdLookup.get(normalized) || null;
    if (lookedUpName) {
      return {
        code: canonical,
        name: lookedUpName,
        referenceStatus: 'available',
        source: item.source,
      };
    }
  }

  return {
    code: null,
    name: null,
    referenceStatus: 'missing_icd10_reference',
    source: null,
  };
}

function pickTriage(row) {
  const noteRefs = parseJsonSafe(row.evidence_refs);
  const level = firstNonEmpty(row.triage_level, noteRefs?.latest_chat_note_triage);
  const status = firstNonEmpty(row.note_status, row.exam_status);
  return {
    level: level || null,
    status: status || null,
    referenceStatus: level ? 'available' : 'missing_triage_reference',
  };
}

function buildClinicalContext(row) {
  const noteRefs = parseJsonSafe(row.evidence_refs);
  const summary = firstNonEmpty(
    row.summary,
    noteRefs?.latest_chat_note_summary,
    row.examination_notes,
    row.soap_subjective,
    row.soap_objective
  );

  const latestCondition = firstNonEmpty(
    row.patient_condition,
    noteRefs?.latest_chat_note_summary,
    row.summary,
    row.examination_notes
  );

  const clinicalNotes = joinNonEmpty([
    row.note_assessment,
    row.note_plan,
    row.medication_recommendation,
    noteRefs?.latest_chat_note_assessment,
    noteRefs?.latest_chat_note_plan,
    row.examination_notes,
  ], ' | ');

  const examinationData = joinNonEmpty([
    row.soap_subjective,
    row.soap_objective,
    row.soap_assessment,
    row.soap_plan,
  ], ' | ');

  return {
    summary: summary || null,
    latestCondition: latestCondition || null,
    clinicalNotes: clinicalNotes || null,
    examinationData: examinationData || null,
  };
}

function chooseSubjective(row, clinicalContext) {
  return firstNonEmpty(
    row.soap_subjective,
    clinicalContext.summary,
    clinicalContext.latestCondition,
    row.examination_notes,
    clinicalContext.clinicalNotes
  );
}

function chooseObjective(row, clinicalContext) {
  return firstNonEmpty(
    row.soap_objective,
    clinicalContext.examinationData,
    row.examination_notes,
    clinicalContext.clinicalNotes
  );
}

function chooseAssessment(row, icd10, clinicalContext) {
  return firstNonEmpty(
    row.soap_assessment,
    row.note_assessment,
    parseJsonSafe(row.evidence_refs)?.latest_chat_note_assessment,
    clinicalContext.clinicalNotes,
    icd10.name
  );
}

function choosePlan(row, clinicalContext) {
  return firstNonEmpty(
    row.soap_plan,
    row.note_plan,
    parseJsonSafe(row.evidence_refs)?.latest_chat_note_plan,
    row.medication_recommendation,
    clinicalContext.clinicalNotes
  );
}

function trimTerminalPunctuation(value) {
  return normalizeText(value).replace(/[.\s]+$/u, '').trim();
}

function buildStructuredReference({ subjective, objective, assessment, icd10, triage, plan }) {
  const subjectiveText = trimTerminalPunctuation(subjective) || 'no subjective complaint is documented';
  const objectiveText = trimTerminalPunctuation(objective) || 'no objective findings are documented';
  const assessmentText = trimTerminalPunctuation(assessment) || 'no assessment is documented';
  const icdText = icd10.code && icd10.name
    ? `ICD-10 code ${icd10.code}, ${trimTerminalPunctuation(icd10.name)}`
    : 'a missing ICD-10 reference';
  const triageText = trimTerminalPunctuation(triage.level) || 'missing triage reference';
  const planText = trimTerminalPunctuation(plan) || 'no management plan is documented';

  return `The patient presents with ${subjectiveText}. Objective findings show ${objectiveText}. The clinical assessment is ${assessmentText}, supported by ${icdText}. The triage level is ${triageText}. The recommended plan is ${planText}.`;
}

function buildReferenceCase(row, icdLookup, caseIndex) {
  const clinicalContext = buildClinicalContext(row);
  const icd10 = pickIcd10(row, icdLookup);
  const triage = pickTriage(row);
  const subjective = chooseSubjective(row, clinicalContext);
  const objective = chooseObjective(row, clinicalContext);
  const assessment = chooseAssessment(row, icd10, clinicalContext);
  const plan = choosePlan(row, clinicalContext);
  const structuredReference = buildStructuredReference({ subjective, objective, assessment, icd10, triage, plan });

  const patientIdentifier = normalizeText(row.no_rm);
  const dateOfBirth = formatDate(row.date_of_birth);
  const age = calculateAge(row.date_of_birth);

  const missingFields = [];
  if (!patientIdentifier) {
    missingFields.push('noRm');
  }
  if (!subjective) {
    missingFields.push('soapNote.subjective');
  }
  if (!objective) {
    missingFields.push('soapNote.objective');
  }
  if (!assessment) {
    missingFields.push('soapNote.assessment');
  }
  if (!plan) {
    missingFields.push('soapNote.plan');
  }
  if (!icd10.code) {
    missingFields.push('icd10.code');
  }
  if (!icd10.name) {
    missingFields.push('icd10.name');
  }
  if (!triage.level) {
    missingFields.push('triage.level');
  }
  if (!structuredReference) {
    missingFields.push('structuredReference');
  }

  const isUsableForNlpEvaluation = Boolean(
    patientIdentifier &&
    (subjective || clinicalContext.summary || clinicalContext.latestCondition || clinicalContext.clinicalNotes) &&
    (objective || clinicalContext.examinationData || clinicalContext.clinicalNotes) &&
    (assessment || icd10.code) &&
    structuredReference
  );

  const referenceStatus = !isUsableForNlpEvaluation
    ? 'missing_required_data'
    : missingFields.length === 0
      ? 'complete'
      : 'partial';

  return {
    caseId: `CASE${String(caseIndex).padStart(3, '0')}`,
    nurseUsername: normalizeText(row.nurse_username),
    nurseFullName: normalizeText(row.nurse_full_name) || null,
    patientName: normalizeText(row.patient_name),
    noRm: normalizeText(row.no_rm),
    registrationId: Number(row.registration_id),
    patientData: {
      age,
      gender: null,
      additionalInfo: {
        dateOfBirth,
        patientId: Number(row.patient_id),
        patientSource: row.patient_source || null,
        insuranceType: row.insurance_type || null,
        registrationStatus: row.registration_status || null,
        registrationType: row.registration_type || null,
        registrationDate: formatDate(row.registration_date),
        doctorName: row.doctor_name || null,
        doctorSpecialization: row.doctor_specialization || null,
      },
    },
    soapNote: {
      subjective: subjective || null,
      objective: objective || null,
      assessment: assessment || null,
      plan: plan || null,
    },
    icd10: {
      code: icd10.code,
      name: icd10.name,
      referenceStatus: icd10.referenceStatus,
      source: icd10.source,
    },
    triage: {
      level: triage.level,
      status: triage.status,
      referenceStatus: triage.referenceStatus,
    },
    clinicalContext: {
      summary: clinicalContext.summary,
      latestCondition: clinicalContext.latestCondition,
      clinicalNotes: clinicalContext.clinicalNotes,
      examinationData: clinicalContext.examinationData,
    },
    structuredReference,
    referenceStatus,
    missingFields,
    isUsableForNlpEvaluation,
    provenance: {
      registrationStatus: row.registration_status || null,
      examStatus: row.exam_status || null,
      noteStatus: row.note_status || null,
      noteSource: row.note_source || null,
      examId: row.exam_id ? Number(row.exam_id) : null,
      noteId: row.note_id ? Number(row.note_id) : null,
    },
  };
}

function buildSummary(references) {
  const missingFieldCounts = {};
  for (const reference of references) {
    for (const field of reference.missingFields || []) {
      missingFieldCounts[field] = (missingFieldCounts[field] || 0) + 1;
    }
  }

  return {
    totalCases: references.length,
    completeReferences: references.filter((item) => item.referenceStatus === 'complete').length,
    partialReferences: references.filter((item) => item.referenceStatus === 'partial').length,
    missingRequiredData: references.filter((item) => item.referenceStatus === 'missing_required_data').length,
    usableForNlpEvaluation: references.filter((item) => item.isUsableForNlpEvaluation).length,
    notUsableForNlpEvaluation: references.filter((item) => !item.isUsableForNlpEvaluation).length,
    missingFieldCounts,
  };
}

function buildCsv(references) {
  const header = [
    'caseId',
    'nurseUsername',
    'nurseFullName',
    'patientName',
    'noRm',
    'registrationId',
    'age',
    'gender',
    'icd10Code',
    'icd10Name',
    'triageLevel',
    'referenceStatus',
    'isUsableForNlpEvaluation',
    'missingFields',
    'structuredReference',
  ];

  const rows = references.map((item) => [
    item.caseId,
    item.nurseUsername,
    item.nurseFullName || '',
    item.patientName,
    item.noRm,
    item.registrationId,
    item.patientData.age ?? '',
    item.patientData.gender ?? '',
    item.icd10.code || '',
    item.icd10.name || '',
    item.triage.level || '',
    item.referenceStatus,
    item.isUsableForNlpEvaluation ? 'true' : 'false',
    (item.missingFields || []).join('; '),
    item.structuredReference,
  ]);

  return [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function buildMarkdownTable(references) {
  const header = [
    '| Case ID | Nurse | Patient | NRM | Registration ID | ICD-10 | Triage | Reference Status | Usable | Missing Fields |',
    '|---|---|---|---|---:|---|---|---|---|---|',
  ];

  const rows = references.map((item) => {
    const icd = item.icd10.code && item.icd10.name ? `${item.icd10.code} ${item.icd10.name}` : 'missing_icd10_reference';
    return `| ${escapeHtml(item.caseId)} | ${escapeHtml(item.nurseUsername)} | ${escapeHtml(item.patientName)} | ${escapeHtml(item.noRm)} | ${item.registrationId} | ${escapeHtml(icd)} | ${escapeHtml(item.triage.level || 'missing_triage_reference')} | ${escapeHtml(item.referenceStatus)} | ${item.isUsableForNlpEvaluation ? 'yes' : 'no'} | ${escapeHtml((item.missingFields || []).join(', ') || '-')} |`;
  });

  return [...header, ...rows].join('\n');
}

function buildLatexTable(references) {
  const rows = references.map((item) => {
    const icd = item.icd10.code && item.icd10.name ? `${item.icd10.code} ${item.icd10.name}` : 'missing\_icd10\_reference';
    return `${escapeLatex(item.caseId)} & ${escapeLatex(item.nurseUsername)} & ${escapeLatex(item.patientName)} & ${escapeLatex(item.noRm)} & ${item.registrationId} & ${escapeLatex(icd)} & ${escapeLatex(item.triage.level || 'missing_triage_reference')} & ${escapeLatex(item.referenceStatus)} & ${item.isUsableForNlpEvaluation ? 'yes' : 'no'} \\\\`;
  });

  return String.raw`\begin{table}[htbp]
\centering
\small
\begin{tabular}{l l l l r l l l l}
\hline
Case ID & Nurse & Patient & NRM & Registration ID & ICD-10 & Triage & Reference Status & Usable \\\n\hline
${rows.join('\n')}
\hline
\end{tabular}
\caption{Structured clinical reference cases generated from database records for Phase 5 preparation.}
\label{tab:phase5-structured-reference}
\end{table}`;
}

function buildReport(summary, references) {
  const topMissing = Object.entries(summary.missingFieldCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const example = references[0];
  const exampleText = example ? example.structuredReference : 'No reference generated.';

  return `# Phase 5 Structured Clinical Reference Report

This run generated ${summary.totalCases} structured clinical references directly from the database for future NLP evaluation.

## Summary
- Complete references: ${summary.completeReferences}
- Partial references: ${summary.partialReferences}
- Missing required data: ${summary.missingRequiredData}
- Usable for NLP evaluation: ${summary.usableForNlpEvaluation}
- Not usable for NLP evaluation: ${summary.notUsableForNlpEvaluation}

## Frequently Missing Fields
${topMissing.length > 0 ? topMissing.map(([field, count]) => `- ${field}: ${count}`).join('\n') : '- No missing fields were recorded.'}

## Example Reference
${exampleText}

## Notes
- The reference set is built from database content only.
- ICD-10 names are resolved from the icd10_diagnoses table when needed.
- The output is ready to serve as a gold/reference baseline for later BLEU, ROUGE-L, and BERTScore evaluation if the usable count remains complete.`;
}

async function writeOutputs(references, summary) {
  const jsonPath = path.join(RESULTS_DIR, 'phase5_structured_clinical_references.json');
  const csvPath = path.join(RESULTS_DIR, 'phase5_structured_clinical_references.csv');
  const mdPath = path.join(RESULTS_DIR, 'phase5_structured_clinical_references.md');
  const texPath = path.join(RESULTS_DIR, 'phase5_structured_clinical_references_latex.tex');
  const summaryPath = path.join(RESULTS_DIR, 'phase5_reference_generation_summary.json');
  const reportPath = path.join(RESULTS_DIR, 'phase5_reference_generation_report.md');

  const payload = JSON.stringify(references, null, 2);
  const summaryPayload = JSON.stringify(summary, null, 2);
  const csvContent = buildCsv(references);
  const mdContent = `# Phase 5 Structured Clinical References\n\n${buildMarkdownTable(references)}\n`;
  const texContent = buildLatexTable(references);
  const reportContent = buildReport(summary, references);

  await writeTextFile(jsonPath, payload);
  await writeTextFile(csvPath, csvContent);
  await writeTextFile(mdPath, mdContent);
  await writeTextFile(texPath, texContent);
  await writeTextFile(summaryPath, summaryPayload);
  await writeTextFile(reportPath, reportContent);

  const mirroredFiles = [
    'phase5_structured_clinical_references.json',
    'phase5_structured_clinical_references.csv',
    'phase5_structured_clinical_references.md',
    'phase5_structured_clinical_references_latex.tex',
    'phase5_reference_generation_summary.json',
    'phase5_reference_generation_report.md',
  ];

  for (const fileName of mirroredFiles) {
    await copyIfExists(path.join(RESULTS_DIR, fileName), path.join(PHASE5_DIR, fileName));
    await copyIfExists(path.join(RESULTS_DIR, fileName), path.join(PHASE5_REFERENCE_DIR, fileName));
  }

  const readme = `# Phase 5 Structured Clinical References\n\nThis folder groups the database-derived structured clinical references used as the comparison baseline for future NLP evaluation.\n\n- \`phase5_structured_clinical_references.json\`: full case-level reference objects\n- \`phase5_structured_clinical_references.csv\`: per-case tabular summary\n- \`phase5_structured_clinical_references.md\`: Markdown summary table\n- \`phase5_structured_clinical_references_latex.tex\`: LaTeX table for papers\n- \`phase5_reference_generation_summary.json\`: generation statistics\n- \`phase5_reference_generation_report.md\`: narrative report and missing-field notes\n\nReference snapshot:\n- \`reference/\`: frozen copy of the Phase 5 outputs for comparison and reuse.\n`;

  const referenceReadme = `# Phase 5 Reference Snapshot\n\nThis folder is a frozen copy of the Phase 5 structured clinical references for comparison and downstream NLP evaluation.\n\n- \`phase5_structured_clinical_references.json\`\n- \`phase5_structured_clinical_references.csv\`\n- \`phase5_structured_clinical_references.md\`\n- \`phase5_structured_clinical_references_latex.tex\`\n- \`phase5_reference_generation_summary.json\`\n- \`phase5_reference_generation_report.md\`\n`;

  await writeTextFile(path.join(PHASE5_DIR, 'README.md'), readme);
  await writeTextFile(path.join(PHASE5_REFERENCE_DIR, 'README.md'), referenceReadme);
}

async function main() {
  await loadDotEnvIfNeeded();
  await ensureOutputDirectories();

  const args = parseArgs(process.argv.slice(2));
  const client = await connectDatabase();

  try {
    const candidates = await loadReferenceCandidates(client, args.limit);
    if (candidates.length === 0) {
      throw new Error('Tidak ada pasangan perawat-pasien yang memenuhi syarat untuk structured reference.');
    }

    if (candidates.length < args.limit) {
      console.warn(`Dataset hanya menyediakan ${candidates.length} candidate reference, lebih kecil dari limit ${args.limit}.`);
    }

    const icdLookup = await loadIcdLookup(client, candidates);
    const references = candidates.slice(0, args.limit).map((row, index) => buildReferenceCase(row, icdLookup, index + 1));
    const summary = buildSummary(references);

    await writeOutputs(references, summary);

    console.log(`Phase 5 structured clinical references generated: ${summary.totalCases}`);
    console.log(`Complete references: ${summary.completeReferences}`);
    console.log(`Partial references: ${summary.partialReferences}`);
    console.log(`Missing required data: ${summary.missingRequiredData}`);
    console.log(`Usable for NLP evaluation: ${summary.usableForNlpEvaluation}`);
    console.log(`Not usable for NLP evaluation: ${summary.notUsableForNlpEvaluation}`);
    console.log(`Reference snapshot folder: ${path.relative(PROJECT_ROOT, PHASE5_REFERENCE_DIR)}`);
    console.log(`Example case: ${references[0]?.caseId || '-'}`);
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
