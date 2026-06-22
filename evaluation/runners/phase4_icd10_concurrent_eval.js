import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from 'pg';
import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const RESULTS_DIR = path.join(PROJECT_ROOT, 'evaluation', 'results');
const PHASE4_DIR = path.join(RESULTS_DIR, 'phase4_icd10_concurrent');
const DOTENV_PATH = path.join(PROJECT_ROOT, '.env');

const DEFAULT_BASE_URL = process.env.EVAL_BASE_URL || process.env.APP_BASE_URL || 'http://127.0.0.1:3000';
const DEFAULT_LIMIT = 30;
const DEFAULT_CONCURRENCY = 30;

const NURSE_FIXTURES = [
  { username: 'arga', password: 'perawat01' },
  { username: 'nisa', password: 'perawat02' },
  { username: 'rafi', password: 'perawat03' },
  { username: 'dinda', password: 'perawat04' },
  { username: 'bagas', password: 'perawat05' },
  { username: 'putri', password: 'perawat06' },
  { username: 'ilham', password: 'perawat07' },
  { username: 'ratih', password: 'perawat08' },
  { username: 'fajar', password: 'perawat09' },
  { username: 'tiara', password: 'perawat10' },
  { username: 'galih', password: 'perawat11' },
  { username: 'anisa', password: 'perawat12' },
  { username: 'rizky', password: 'perawat13' },
  { username: 'fitri', password: 'perawat14' },
  { username: 'yudha', password: 'perawat15' },
  { username: 'linda', password: 'perawat16' },
  { username: 'arif', password: 'perawat17' },
  { username: 'vina', password: 'perawat18' },
  { username: 'faris', password: 'perawat19' },
  { username: 'desi', password: 'perawat20' },
  { username: 'alif', password: 'perawat21' },
  { username: 'intan', password: 'perawat22' },
  { username: 'hafiz', password: 'perawat23' },
  { username: 'dewi', password: 'perawat24' },
  { username: 'ridwan', password: 'perawat25' },
  { username: 'melati', password: 'perawat26' },
  { username: 'farhan', password: 'perawat27' },
  { username: 'ayu', password: 'perawat28' },
  { username: 'fikri', password: 'perawat29' },
  { username: 'zahra', password: 'perawat30' },
];

const STAGES = [
  { key: 'summary', label: 'Clinical summary', route: '/api/chat', icdRelevant: true, triageRelevant: true, directEndpoint: false },
  { key: 'objective', label: 'Objective summary', route: '/api/chat', icdRelevant: false, triageRelevant: false, directEndpoint: false },
  { key: 'update', label: 'Update kondisi pasien', route: '/api/chat', icdRelevant: true, triageRelevant: true, directEndpoint: false },
  { key: 'generate', label: 'Generate clinical notes', route: '/api/clinical-notes/generate', icdRelevant: true, triageRelevant: true, directEndpoint: true },
];

function parseArgs(argv) {
  const args = {
    baseUrl: DEFAULT_BASE_URL,
    limit: DEFAULT_LIMIT,
    concurrency: DEFAULT_CONCURRENCY,
    dryRun: false,
  };

  for (const value of argv) {
    if (value === '--dry-run') {
      args.dryRun = true;
    } else if (value.startsWith('--base-url=')) {
      args.baseUrl = value.slice('--base-url='.length);
    } else if (value.startsWith('--limit=')) {
      args.limit = Number(value.slice('--limit='.length));
    } else if (value.startsWith('--concurrency=')) {
      args.concurrency = Number(value.slice('--concurrency='.length));
    }
  }

  return args;
}

function readText(value, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function safeText(value, fallback = '-') {
  const text = value === null || value === undefined ? '' : String(value);
  return text.trim() || fallback;
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

function formatPercent(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'N/A';
  }
  return `${value.toFixed(1)}%`;
}

function formatLatency(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'N/A';
  }
  return `${Math.round(value)} ms`;
}

function mean(values) {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (filtered.length === 0) {
    return null;
  }
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function percent(numerator, denominator) {
  if (!denominator) {
    return null;
  }
  return (numerator / denominator) * 100;
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || '').replace(/\/+$/, '');
}

function normalizeIcd10Code(code) {
  const cleaned = String(code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.]/g, '');

  if (!cleaned) {
    return '';
  }

  return cleaned.replace(/\./g, '');
}

function canonicalizeIcd10Code(code) {
  const cleaned = String(code || '')
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

function extractIcd10CodesFromText(text) {
  const source = String(text || '');
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

function extractTriageFromText(text) {
  const source = String(text || '');
  const match = source.match(/(?:^|\n)\s*(?:TRIAGE|Triage)\s*:\s*([A-Z]+)\s*(?:\n|$)/i);
  if (match && match[1]) {
    return match[1].trim().toUpperCase();
  }

  const fallback = source.match(/\b(?:TRIAGE|Triage)\b[\s:]+([A-Z]+)\b/);
  return fallback?.[1] ? fallback[1].trim().toUpperCase() : null;
}

function splitSetCookieHeader(headerValue) {
  if (!headerValue) {
    return [];
  }

  return headerValue
    .split(/,(?=[^;,=]+=[^;,=]+)/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function getHeadersFromCookies(cookiePairs) {
  const normalized = cookiePairs
    .filter(Boolean)
    .map((cookie) => (String(cookie).includes('=') ? String(cookie) : `darsi_nurse_session=${String(cookie)}`));

  if (normalized.length === 0) {
    return {};
  }

  return {
    Cookie: normalized.join('; '),
  };
}

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function fetchJson(url, options = {}) {
  const startedAt = Date.now();
  const response = await fetch(url, options);
  const text = await response.text();
  const parsed = parseJsonSafe(text);
  const setCookies = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : splitSetCookieHeader(response.headers.get('set-cookie'));

  return {
    ok: response.ok,
    status: response.status,
    latencyMs: Date.now() - startedAt,
    setCookies,
    body: parsed ?? text,
    text,
  };
}

async function loadDotEnvIfNeeded() {
  const keys = ['EVAL_BASE_URL', 'APP_BASE_URL', 'HOSPITAL_CS_DATABASE_URL', 'DATABASE_URL'];
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length === 0) {
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
    // Ignore .env parsing failures and rely on the environment.
  }
}

function getDatabaseUrl() {
  return process.env.HOSPITAL_CS_DATABASE_URL || process.env.DATABASE_URL;
}

async function connectDatabase() {
  const connectionString = getDatabaseUrl();
  if (!connectionString) {
    throw new Error('HOSPITAL_CS_DATABASE_URL atau DATABASE_URL belum dikonfigurasi.');
  }

  const client = new Client({ connectionString });
  await client.connect();
  return client;
}

async function ensureResultsDir() {
  await fs.mkdir(RESULTS_DIR, { recursive: true });
  await fs.mkdir(PHASE4_DIR, { recursive: true });
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

function buildExternalExaminationPriorityOrder(alias) {
  return `
    CASE
      WHEN COALESCE(
        NULLIF(BTRIM(${alias}.soap_subjective), ''),
        NULLIF(BTRIM(${alias}.soap_objective), ''),
        NULLIF(BTRIM(${alias}.soap_assessment), ''),
        NULLIF(BTRIM(${alias}.soap_plan), ''),
        NULLIF(BTRIM(${alias}.examination_notes), '')
      ) IS NOT NULL THEN 0
      WHEN LOWER(COALESCE(${alias}.status, '')) = 'examined' THEN 1
      ELSE 2
    END,
    COALESCE(${alias}.updated_at, ${alias}.created_at) DESC,
    ${alias}.id DESC
  `;
}

async function loadTestCases(client, limit) {
  const result = await client.query(
    `SELECT
       n.id AS nurse_id,
       n.username AS nurse_username,
       n.full_name AS nurse_full_name,
       p.id AS patient_id,
       p.no_rm,
       p.full_name AS patient_name,
       p.medical_record,
       r.id AS registration_id,
       r.status AS registration_status,
       r.doctor_id,
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
       cn.id AS note_id,
       cn.source AS note_source,
       cn.status AS note_status,
       cn.triage_level AS note_triage_level,
       cn.patient_condition,
       cn.summary,
       cn.assessment AS note_assessment,
       cn.plan AS note_plan,
       cn.evidence_refs,
       cn.created_at AS note_created_at
     FROM indirect_staff_nurses n
     JOIN registrations r ON r.nurse_id = n.id
     JOIN patients p ON p.id = r.patient_id
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
       ORDER BY ${buildExternalExaminationPriorityOrder('ee')}
       LIMIT 1
     ) ee ON true
     LEFT JOIN LATERAL (
       SELECT
         id,
         source,
         status,
         triage_level,
         patient_condition,
         summary,
         assessment,
         plan,
         evidence_refs,
         created_at
       FROM clinical_notes cn
       WHERE cn.patient_id = p.id
         AND cn.evidence_refs->>'nurse_id' = n.id::text
         AND cn.evidence_refs->>'registration_id' = r.id::text
       ORDER BY cn.created_at DESC, cn.id DESC
       LIMIT 1
     ) cn ON true
     WHERE p.no_rm LIKE 'RMDUMMY26%'
     ORDER BY n.id ASC
     LIMIT $1`,
    [limit]
  );

  return result.rows.map((row) => {
    const diagnoses = Array.isArray(row.diagnoses) ? row.diagnoses : [];
    const evidenceRefs = row.evidence_refs && typeof row.evidence_refs === 'object' ? row.evidence_refs : null;

    return {
      nurseId: Number(row.nurse_id),
      nurseUsername: String(row.nurse_username),
      nurseFullName: String(row.nurse_full_name || row.nurse_username || '-'),
      patientId: Number(row.patient_id),
      patientName: String(row.patient_name || '-'),
      noRm: String(row.no_rm || '-'),
      registrationId: Number(row.registration_id),
      registrationStatus: String(row.registration_status || '-'),
      doctorId: Number(row.doctor_id),
      doctorName: String(row.doctor_name || '-'),
      doctorSpecialization: String(row.doctor_specialization || '-'),
      examId: row.exam_id ? Number(row.exam_id) : null,
      examStatus: row.exam_status || null,
      soapSubjective: row.soap_subjective || null,
      soapObjective: row.soap_objective || null,
      soapAssessment: row.soap_assessment || null,
      soapPlan: row.soap_plan || null,
      diagnoses,
      examinationNotes: row.examination_notes || null,
      noteId: row.note_id ? Number(row.note_id) : null,
      noteSource: row.note_source || null,
      noteStatus: row.note_status || null,
      noteTriageLevel: row.note_triage_level || null,
      patientCondition: row.patient_condition || null,
      summary: row.summary || null,
      noteAssessment: row.note_assessment || null,
      notePlan: row.note_plan || null,
      evidenceRefs,
      noteCreatedAt: row.note_created_at || null,
    };
  });
}

function buildReferenceCodes(caseRow) {
  const sources = [];
  if (Array.isArray(caseRow.diagnoses)) {
    sources.push(...caseRow.diagnoses);
  }

  const evidenceRefs = caseRow.evidenceRefs;
  if (evidenceRefs && Array.isArray(evidenceRefs.icd)) {
    sources.push(...evidenceRefs.icd);
  }

  const textSources = [
    caseRow.soapAssessment,
    caseRow.examinationNotes,
    caseRow.noteAssessment,
    caseRow.summary,
  ].filter(Boolean);

  const codes = [];
  const seen = new Set();

  for (const item of sources) {
    const raw = item && typeof item === 'object' ? (item.icd_code || item.code || item.icdCode) : item;
    const canonical = canonicalizeIcd10Code(raw);
    const normalized = normalizeIcd10Code(canonical);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    codes.push(canonical);
  }

  for (const text of textSources) {
    for (const code of extractIcd10CodesFromText(text)) {
      const normalized = normalizeIcd10Code(code);
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      codes.push(code);
    }
  }

  const referenceTriages = [];
  const noteTriage = readText(caseRow.noteTriageLevel, '').trim().toUpperCase();
  if (noteTriage) {
    referenceTriages.push(noteTriage);
  }

  return {
    referenceIcd10Codes: codes,
    referenceIcd10Normalized: codes.map(normalizeIcd10Code),
    referenceTriages,
    referenceAvailable: codes.length > 0,
    triageAvailable: referenceTriages.length > 0,
    referenceStatus: codes.length > 0 ? 'available' : 'missing_reference',
  };
}

function normalizeTriageLabel(value) {
  const text = String(value || '').trim().toUpperCase();
  if (!text) {
    return null;
  }

  const allowed = new Set(['URGENT', 'HIGH', 'MODERATE', 'LOW', 'UNKNOWN']);
  if (allowed.has(text)) {
    return text;
  }

  return null;
}

function buildUpdateText(caseRow) {
  const haystack = [
    caseRow.noRm,
    caseRow.patientName,
    caseRow.soapSubjective,
    caseRow.soapObjective,
    caseRow.soapAssessment,
    caseRow.soapPlan,
    caseRow.examinationNotes,
    caseRow.summary,
    caseRow.noteAssessment,
    ...(caseRow.diagnoses || []).map((item) => `${item.icd_code || ''} ${item.icd_name || ''}`),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const scenarios = [
    { hints: ['r50', 'demam', 'fever'], text: 'update kondisi pasien: demam membaik, masih lemas, nafsu makan mulai membaik.' },
    { hints: ['j06', 'j00', 'batuk', 'pilek', 'cough', 'cold', 'ispa'], text: 'update kondisi pasien: batuk berkurang, pilek masih ringan, tenggorokan tidak terlalu gatal.' },
    { hints: ['k29', 'k30', 'nyeri ulu hati', 'dyspepsia', 'gastritis', 'maag', 'mual'], text: 'update kondisi pasien: nyeri ulu hati membaik, mual berkurang, perut tidak terlalu begah.' },
    { hints: ['g43', 'sakit kepala', 'headache', 'migrain'], text: 'update kondisi pasien: sakit kepala membaik, mual berkurang, sensitif cahaya mulai menurun.' },
    { hints: ['a09', 'diare', 'gastroenteritis', 'muntah'], text: 'update kondisi pasien: diare berkurang, mulas mulai reda, masih agak lemas.' },
    { hints: ['j45', 'asma', 'sesak', 'wheezing'], text: 'update kondisi pasien: sesak berkurang, batuk kering masih ada malam hari, napas terasa lebih lega.' },
    { hints: ['m79.1', 'myalgia', 'nyeri otot', 'pegal'], text: 'update kondisi pasien: nyeri otot berkurang setelah istirahat, pegal ringan masih ada.' },
    { hints: ['i10', 'hipertensi', 'tekanan darah tinggi'], text: 'update kondisi pasien: tekanan darah masih tinggi, pusing berkurang, belum ada keluhan baru.' },
    { hints: ['n39', 'nyeri bak', 'disuria', 'urine', 'urin'], text: 'update kondisi pasien: nyeri BAK masih ada, frekuensi berkurang, tidak ada demam baru.' },
    { hints: ['l29', 'gatal', 'pruritus', 'ruam'], text: 'update kondisi pasien: gatal masih ada namun berkurang, ruam tidak meluas.' },
    { hints: ['m54', 'nyeri punggung', 'back pain'], text: 'update kondisi pasien: nyeri punggung berkurang, masih kaku saat bergerak.' },
  ];

  for (const scenario of scenarios) {
    if (scenario.hints.some((hint) => haystack.includes(hint))) {
      return scenario.text;
    }
  }

  return 'update kondisi pasien: keluhan utama berkurang, pasien masih lemas, kondisi umum stabil.';
}

function buildSummaryMessage() {
  return 'Ringkaskan kondisi pasien ini berdasarkan SOAP dan clinical summary. Fokus pada kondisi pasien, assessment, plan, dan tindakan.';
}

function buildObjectiveMessage() {
  return 'Ringkasan objective pasien.';
}

function buildPayloads(caseRow) {
  return {
    summary: {
      message: buildSummaryMessage(),
      patientId: String(caseRow.patientId),
      registrationId: caseRow.registrationId,
    },
    objective: {
      message: buildObjectiveMessage(),
      patientId: String(caseRow.patientId),
      registrationId: caseRow.registrationId,
    },
    update: {
      message: buildUpdateText(caseRow),
      patientId: String(caseRow.patientId),
      registrationId: caseRow.registrationId,
    },
    generate: {
      patientId: caseRow.patientId,
      triageVisitId: null,
    },
  };
}

function summarizeResponse(response) {
  if (!response) {
    return {
      ok: false,
      status: 0,
      latencyMs: 0,
      text: null,
      body: null,
      error: 'No response',
    };
  }

  const body = response.body && typeof response.body === 'object' ? response.body : null;
  const message = body && typeof body.message === 'string' ? body.message : null;
  const error = body && typeof body.error === 'string' ? body.error : null;

  return {
    ok: Boolean(response.ok),
    status: response.status,
    latencyMs: response.latencyMs,
    text: response.text,
    body,
    message,
    error,
  };
}

function extractChatResult(stageKey, responseSummary) {
  const text = responseSummary.message || responseSummary.text || '';
  const generatedIcd10Codes = extractIcd10CodesFromText(text);
  const generatedTriage = normalizeTriageLabel(extractTriageFromText(text));
  return {
    generatedIcd10Codes,
    generatedIcd10Normalized: generatedIcd10Codes.map(normalizeIcd10Code),
    generatedTriage,
  };
}

function extractClinicalNoteResult(responseSummary) {
  const body = responseSummary.body || {};
  const note = body.note && typeof body.note === 'object' ? body.note : null;
  const noteAssessment = note && typeof note.assessment === 'string' ? note.assessment : '';
  const noteSummary = note && typeof note.summary === 'string' ? note.summary : '';
  const noteTriageLevel = note && typeof note.triage_level === 'string' ? note.triage_level : null;
  const evidenceRefs = note && note.evidence_refs && typeof note.evidence_refs === 'object' ? note.evidence_refs : null;

  const generatedIcd10Codes = [];
  const seen = new Set();

  for (const code of extractIcd10CodesFromText(`${noteAssessment}\n${noteSummary}`)) {
    const normalized = normalizeIcd10Code(code);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    generatedIcd10Codes.push(code);
  }

  if (evidenceRefs && Array.isArray(evidenceRefs.icd)) {
    for (const item of evidenceRefs.icd) {
      const raw = item && typeof item === 'object' ? (item.icd_code || item.code || item.icdCode) : item;
      const canonical = canonicalizeIcd10Code(raw);
      const normalized = normalizeIcd10Code(canonical);
      if (!normalized || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      generatedIcd10Codes.push(canonical);
    }
  }

  const generatedTriage = normalizeTriageLabel(noteTriageLevel);

  return {
    generatedIcd10Codes,
    generatedIcd10Normalized: generatedIcd10Codes.map(normalizeIcd10Code),
    generatedTriage,
    noteSummary,
    noteAssessment,
    noteTriageLevel: generatedTriage,
  };
}

function evaluateIcd10Case(stage, caseRow, reference, generated) {
  const diagnosisRelated = stage.icdRelevant && reference.referenceAvailable;
  const referenceIcdSet = new Set(reference.referenceIcd10Normalized);
  const generatedIcdSet = new Set((generated.generatedIcd10Normalized || []).filter(Boolean));
  const generatedList = generated.generatedIcd10Codes || [];

  const hasGenerated = generatedList.length > 0;
  const supportedMatches = generated.generatedIcd10Normalized.filter((code) => referenceIcdSet.has(code));
  const unsupportedMatches = generated.generatedIcd10Normalized.filter((code) => !referenceIcdSet.has(code));

  const grounded = diagnosisRelated ? supportedMatches.length > 0 : null;
  const unsupported = diagnosisRelated ? unsupportedMatches.length > 0 : null;
  const correctRetrieval = diagnosisRelated ? (hasGenerated && unsupportedMatches.length === 0) : null;
  const missingIcd10 = diagnosisRelated ? !hasGenerated : null;
  const wrongIcd10 = diagnosisRelated ? (hasGenerated && unsupportedMatches.length > 0) : null;

  const referenceTriage = reference.referenceTriages[0] || null;
  const outputTriage = generated.generatedTriage || null;
  const triageApplicable = Boolean(stage.triageRelevant && reference.triageAvailable && referenceTriage && outputTriage);
  const triageConsistency = triageApplicable ? referenceTriage === outputTriage : null;

  return {
    stageKey: stage.key,
    key: stage.key,
    stageLabel: stage.label,
    label: stage.label,
    icdRelevant: stage.icdRelevant,
    triageRelevant: stage.triageRelevant,
    route: stage.route,
    directEndpoint: stage.directEndpoint,
    diagnosisRelated,
    referenceStatus: reference.referenceStatus,
    referenceIcd10Codes: reference.referenceIcd10Codes,
    referenceIcd10Normalized: reference.referenceIcd10Normalized,
    referenceTriage,
    generatedIcd10Codes: generated.generatedIcd10Codes,
    generatedIcd10Normalized: generated.generatedIcd10Normalized,
    generatedTriage: outputTriage,
    grounded,
    unsupported,
    correctRetrieval,
    missingIcd10,
    wrongIcd10,
    triageApplicable,
    triageConsistency,
    examStatus: caseRow.status || null,
  };
}

function aggregateStage(stage, caseResults) {
  const totalCases = caseResults.length;
  const diagnosisCases = caseResults.filter((item) => item.diagnosisRelated).length;
  const missingReferenceCases = caseResults.filter((item) => item.referenceStatus === 'missing_reference').length;
  const supportedCount = caseResults.filter((item) => item.grounded === true).length;
  const unsupportedCount = caseResults.filter((item) => item.unsupported === true).length;
  const correctRetrievalCount = caseResults.filter((item) => item.correctRetrieval === true).length;
  const missingIcd10Count = caseResults.filter((item) => item.missingIcd10 === true).length;
  const wrongIcd10Count = caseResults.filter((item) => item.wrongIcd10 === true).length;
  const triageCases = caseResults.filter((item) => item.triageApplicable === true).length;
  const consistentTriageCount = caseResults.filter((item) => item.triageConsistency === true).length;
  const successCount = caseResults.filter((item) => item.status === 200 || item.status === 201).length;
  const latencies = caseResults.map((item) => item.latencyMs).filter((value) => Number.isFinite(value));
  const avgLatencyMs = mean(latencies);

  return {
    stageKey: stage.key,
    key: stage.key,
    stageLabel: stage.label,
    label: stage.label,
    icdRelevant: stage.icdRelevant,
    triageRelevant: stage.triageRelevant,
    route: stage.route,
    directEndpoint: stage.directEndpoint,
    totalCases,
    diagnosisRelatedOutputs: stage.icdRelevant ? diagnosisCases : null,
    supportedIcd10Outputs: stage.icdRelevant ? supportedCount : null,
    unsupportedDiagnosisOutputs: stage.icdRelevant ? unsupportedCount : null,
    correctRetrievalCases: stage.icdRelevant ? correctRetrievalCount : null,
    missingReferenceCases,
    missingIcd10Count: stage.icdRelevant ? missingIcd10Count : null,
    wrongIcd10Count: stage.icdRelevant ? wrongIcd10Count : null,
    groundingAccuracy: stage.icdRelevant ? percent(supportedCount, diagnosisCases) : null,
    unsupportedDiagnosisRate: stage.icdRelevant ? percent(unsupportedCount, diagnosisCases) : null,
    retrievalAccuracy: stage.icdRelevant ? percent(correctRetrievalCount, diagnosisCases) : null,
    missingIcd10Rate: stage.icdRelevant ? percent(missingIcd10Count, diagnosisCases) : null,
    wrongIcd10Rate: stage.icdRelevant ? percent(wrongIcd10Count, diagnosisCases) : null,
    triageRelatedOutputs: stage.triageRelevant ? triageCases : null,
    consistentTriageOutputs: stage.triageRelevant ? consistentTriageCount : null,
    triageConsistencyRate: stage.triageRelevant ? percent(consistentTriageCount, triageCases) : null,
    taskSuccessCount: successCount,
    taskSuccessRate: percent(successCount, totalCases),
    avgLatencyMs,
  };
}

function aggregateOverall(stageSummaries, caseResultsByStage) {
  const relevantStages = stageSummaries.filter((stage) => stage.icdRelevant);
  const overallCases = relevantStages.flatMap((stage) => caseResultsByStage[stage.key] || []);
  const diagnosisCases = overallCases.filter((item) => item.diagnosisRelated);
  const triageCases = overallCases.filter((item) => item.triageApplicable);

  const supportedCount = overallCases.filter((item) => item.grounded === true).length;
  const unsupportedCount = overallCases.filter((item) => item.unsupported === true).length;
  const correctRetrievalCount = overallCases.filter((item) => item.correctRetrieval === true).length;
  const missingIcd10Count = overallCases.filter((item) => item.missingIcd10 === true).length;
  const wrongIcd10Count = overallCases.filter((item) => item.wrongIcd10 === true).length;
  const consistentTriageCount = triageCases.filter((item) => item.triageConsistency === true).length;
  const successCount = stageSummaries
    .map((stage) => (caseResultsByStage[stage.key] || []).filter((item) => item.status === 200 || item.status === 201).length)
    .reduce((sum, value) => sum + value, 0);

  const totalCases = stageSummaries
    .map((stage) => (caseResultsByStage[stage.key] || []).length)
    .reduce((sum, value) => sum + value, 0);

  const latencies = stageSummaries.flatMap((stage) => (caseResultsByStage[stage.key] || []).map((item) => item.latencyMs));
  const avgLatencyMs = mean(latencies);

  return {
    totalCases,
    diagnosisRelatedOutputs: diagnosisCases.length,
    supportedIcd10Outputs: supportedCount,
    unsupportedDiagnosisOutputs: unsupportedCount,
    correctRetrievalCases: correctRetrievalCount,
    missingIcd10Count,
    wrongIcd10Count,
    groundingAccuracy: percent(supportedCount, diagnosisCases.length),
    unsupportedDiagnosisRate: percent(unsupportedCount, diagnosisCases.length),
    retrievalAccuracy: percent(correctRetrievalCount, diagnosisCases.length),
    missingIcd10Rate: percent(missingIcd10Count, diagnosisCases.length),
    wrongIcd10Rate: percent(wrongIcd10Count, diagnosisCases.length),
    triageRelatedOutputs: triageCases.length,
    consistentTriageOutputs: consistentTriageCount,
    triageConsistencyRate: percent(consistentTriageCount, triageCases.length),
    taskSuccessCount: successCount,
    taskSuccessRate: percent(successCount, totalCases),
    avgLatencyMs,
  };
}

function buildStageUpdatePayload(caseRow) {
  return buildPayloads(caseRow).update;
}

function buildSvgBarChart({ title, subtitle, labels, values, unit, maxValue, color = '#0f766e' }) {
  const width = 1180;
  const height = 620;
  const margin = { top: 90, right: 40, bottom: 130, left: 90 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const bars = labels.length;
  const slotWidth = bars > 0 ? chartWidth / bars : chartWidth;
  const barWidth = Math.max(18, Math.min(110, slotWidth * 0.58));
  const yMax = maxValue ?? Math.max(...values.map((value) => (Number.isFinite(value) ? value : 0)), 1);

  const gridLines = 5;
  const gridMarkup = Array.from({ length: gridLines + 1 }, (_, index) => {
    const y = margin.top + (chartHeight / gridLines) * index;
    const value = yMax - (yMax / gridLines) * index;
    return `
      <line x1="${margin.left}" y1="${y.toFixed(2)}" x2="${width - margin.right}" y2="${y.toFixed(2)}" stroke="#dbe4ea" stroke-width="1" />
      <text x="${margin.left - 10}" y="${(y + 4).toFixed(2)}" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="12" fill="#64748b">${unit === '%' ? `${value.toFixed(0)}%` : `${Math.round(value)} ms`}</text>
    `;
  }).join('');

  const barsMarkup = labels.map((label, index) => {
    const value = values[index];
    const x = margin.left + index * slotWidth + (slotWidth - barWidth) / 2;
    const isNa = value === null || value === undefined || !Number.isFinite(value);
    const normalizedValue = isNa ? 0 : value;
    const barHeight = isNa ? 10 : Math.max(1, (normalizedValue / yMax) * chartHeight);
    const y = margin.top + (chartHeight - barHeight);
    const labelY = height - 48;
    const valueY = isNa ? y - 6 : Math.max(margin.top + 18, y - 6);
    return `
      <rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth}" height="${barHeight.toFixed(2)}" rx="10" fill="${isNa ? '#cbd5e1' : color}" />
      <text x="${(x + barWidth / 2).toFixed(2)}" y="${valueY.toFixed(2)}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="13" font-weight="700" fill="#0f172a">${isNa ? 'N/A' : (unit === '%' ? `${normalizedValue.toFixed(1)}%` : `${Math.round(normalizedValue)} ms`)}</text>
      <text x="${(x + barWidth / 2).toFixed(2)}" y="${labelY}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="13" fill="#334155">${escapeHtml(label)}</text>
    `;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeHtml(title)}</title>
  <desc id="desc">${escapeHtml(subtitle)}</desc>
  <rect width="100%" height="100%" fill="#ffffff" />
  <text x="${margin.left}" y="32" font-family="Inter, Arial, sans-serif" font-size="26" font-weight="800" fill="#0f172a">${escapeHtml(title)}</text>
  <text x="${margin.left}" y="54" font-family="Inter, Arial, sans-serif" font-size="13" fill="#64748b">${escapeHtml(subtitle)}</text>
  ${gridMarkup}
  ${barsMarkup}
</svg>`;
}

async function writePng(svg, outputFile) {
  await sharp(Buffer.from(svg)).png().toFile(outputFile);
}

function buildMarkdownTable(stageSummaries) {
  const header = [
    '| Stage | Total Cases | Diagnosis-Related Outputs | Supported ICD-10 Outputs | Unsupported Diagnosis | ICD-10 Grounding Accuracy | Unsupported Diagnosis Rate | ICD-10 Retrieval Accuracy | Missing ICD-10 Rate | Wrong ICD-10 Rate | Avg. Latency |',
    '|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
  ];

  const rows = stageSummaries.map((stage) => {
    const diagnosisRelated = stage.icdRelevant ? stage.diagnosisRelatedOutputs : 'N/A';
    const supported = stage.icdRelevant ? stage.supportedIcd10Outputs : 'N/A';
    const unsupported = stage.icdRelevant ? stage.unsupportedDiagnosisOutputs : 'N/A';
    const groundingAccuracy = stage.icdRelevant ? formatPercent(stage.groundingAccuracy) : 'N/A';
    const unsupportedRate = stage.icdRelevant ? formatPercent(stage.unsupportedDiagnosisRate) : 'N/A';
    const retrievalAccuracy = stage.icdRelevant ? formatPercent(stage.retrievalAccuracy) : 'N/A';
    const missingRate = stage.icdRelevant ? formatPercent(stage.missingIcd10Rate) : 'N/A';
    const wrongRate = stage.icdRelevant ? formatPercent(stage.wrongIcd10Rate) : 'N/A';
    return `| ${stage.label} | ${stage.totalCases} | ${diagnosisRelated} | ${supported} | ${unsupported} | ${groundingAccuracy} | ${unsupportedRate} | ${retrievalAccuracy} | ${missingRate} | ${wrongRate} | ${formatLatency(stage.avgLatencyMs)} |`;
  });

  return [...header, ...rows].join('\n');
}

function buildCsv(stageSummaries) {
  const rows = [
    [
      'Stage',
      'Total Cases',
      'Diagnosis-Related Outputs',
      'Supported ICD-10 Outputs',
      'Unsupported Diagnosis',
      'ICD-10 Grounding Accuracy',
      'Unsupported Diagnosis Rate',
      'ICD-10 Retrieval Accuracy',
      'Missing ICD-10 Rate',
      'Wrong ICD-10 Rate',
      'Avg Latency (ms)',
    ],
  ];

  for (const stage of stageSummaries) {
    rows.push([
      stage.label,
      stage.totalCases,
      stage.icdRelevant ? stage.diagnosisRelatedOutputs : 'N/A',
      stage.icdRelevant ? stage.supportedIcd10Outputs : 'N/A',
      stage.icdRelevant ? stage.unsupportedDiagnosisOutputs : 'N/A',
      stage.icdRelevant ? formatPercent(stage.groundingAccuracy) : 'N/A',
      stage.icdRelevant ? formatPercent(stage.unsupportedDiagnosisRate) : 'N/A',
      stage.icdRelevant ? formatPercent(stage.retrievalAccuracy) : 'N/A',
      stage.icdRelevant ? formatPercent(stage.missingIcd10Rate) : 'N/A',
      stage.icdRelevant ? formatPercent(stage.wrongIcd10Rate) : 'N/A',
      Math.round(stage.avgLatencyMs || 0),
    ]);
  }

  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function buildLatexTable(stageSummaries) {
  const rows = stageSummaries.map((stage) => {
    const diagnosisRelated = stage.icdRelevant ? stage.diagnosisRelatedOutputs : 'N/A';
    const supported = stage.icdRelevant ? stage.supportedIcd10Outputs : 'N/A';
    const unsupported = stage.icdRelevant ? stage.unsupportedDiagnosisOutputs : 'N/A';
    const groundingAccuracy = stage.icdRelevant ? formatPercent(stage.groundingAccuracy) : 'N/A';
    const unsupportedRate = stage.icdRelevant ? formatPercent(stage.unsupportedDiagnosisRate) : 'N/A';
    const retrievalAccuracy = stage.icdRelevant ? formatPercent(stage.retrievalAccuracy) : 'N/A';
    const missingRate = stage.icdRelevant ? formatPercent(stage.missingIcd10Rate) : 'N/A';
    const wrongRate = stage.icdRelevant ? formatPercent(stage.wrongIcd10Rate) : 'N/A';
    return `${escapeLatex(stage.label)} & ${stage.totalCases} & ${diagnosisRelated} & ${supported} & ${unsupported} & ${escapeLatex(groundingAccuracy)} & ${escapeLatex(unsupportedRate)} & ${escapeLatex(retrievalAccuracy)} & ${escapeLatex(missingRate)} & ${escapeLatex(wrongRate)} & ${escapeLatex(formatLatency(stage.avgLatencyMs))} \\\\`;
  });

  return String.raw`\begin{table}[htbp]
\centering
\small
\begin{tabular}{l r r r r r r r r r r}
\hline
Stage & Total Cases & Diagnosis-Related Outputs & Supported ICD-10 Outputs & Unsupported Diagnosis & ICD-10 Grounding Accuracy & Unsupported Diagnosis Rate & ICD-10 Retrieval Accuracy & Missing ICD-10 Rate & Wrong ICD-10 Rate & Avg. Latency \\
\hline
${rows.join('\n')}
\hline
\end{tabular}
\caption{Phase 4 ICD-10 grounding evaluation across concurrent workflow stages. Objective summary is treated as N/A for ICD-10 grounding.}
\label{tab:phase4-icd10-grounding}
\end{table}`;
}

function buildDashboardHtml({ runInfo, stageSummaries, overallSummary }) {
  const cards = [
    { label: 'Nurse runs', value: runInfo.totalNurses },
    { label: 'Total cases', value: runInfo.totalCases },
    { label: 'Started', value: runInfo.startedAt },
    { label: 'Finished', value: runInfo.finishedAt },
    { label: 'Concurrent duration', value: formatLatency(runInfo.totalConcurrentDurationMs) },
    { label: 'Grounding accuracy', value: formatPercent(overallSummary.groundingAccuracy) },
    { label: 'Retrieval accuracy', value: formatPercent(overallSummary.retrievalAccuracy) },
    { label: 'Triage consistency', value: formatPercent(overallSummary.triageConsistencyRate) },
  ];

  const stageRows = stageSummaries.map((stage) => `
    <tr>
      <td>${escapeHtml(stage.label)}</td>
      <td>${stage.totalCases}</td>
      <td>${stage.icdRelevant ? stage.diagnosisRelatedOutputs : 'N/A'}</td>
      <td>${stage.icdRelevant ? stage.supportedIcd10Outputs : 'N/A'}</td>
      <td>${stage.icdRelevant ? stage.unsupportedDiagnosisOutputs : 'N/A'}</td>
      <td>${stage.icdRelevant ? escapeHtml(formatPercent(stage.groundingAccuracy)) : 'N/A'}</td>
      <td>${stage.icdRelevant ? escapeHtml(formatPercent(stage.unsupportedDiagnosisRate)) : 'N/A'}</td>
      <td>${stage.icdRelevant ? escapeHtml(formatPercent(stage.retrievalAccuracy)) : 'N/A'}</td>
      <td>${stage.icdRelevant ? escapeHtml(formatPercent(stage.missingIcd10Rate)) : 'N/A'}</td>
      <td>${stage.icdRelevant ? escapeHtml(formatPercent(stage.wrongIcd10Rate)) : 'N/A'}</td>
      <td>${escapeHtml(formatLatency(stage.avgLatencyMs))}</td>
      <td>${stage.triageRelevant ? escapeHtml(formatPercent(stage.triageConsistencyRate)) : 'N/A'}</td>
    </tr>
  `).join('');

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Phase 4 ICD-10 Concurrent Dashboard</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f8fb;
      --panel: #ffffff;
      --line: #d8e1eb;
      --text: #0f172a;
      --muted: #64748b;
      --accent: #0f766e;
      --accent-2: #2563eb;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: var(--text);
      background:
        radial-gradient(circle at top left, rgba(15, 118, 110, 0.08), transparent 28%),
        radial-gradient(circle at top right, rgba(37, 99, 235, 0.08), transparent 24%),
        var(--bg);
    }
    .wrap { max-width: 1500px; margin: 0 auto; padding: 28px 20px 40px; }
    .hero { display: grid; grid-template-columns: 1.35fr 0.65fr; gap: 18px; margin-bottom: 18px; }
    .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 18px; box-shadow: 0 18px 48px rgba(15, 23, 42, 0.06); }
    .hero-main { padding: 28px; }
    .hero-side { padding: 20px; display: grid; gap: 12px; align-content: start; }
    h1 { margin: 0 0 10px; font-size: 32px; line-height: 1.08; letter-spacing: -0.03em; }
    .subtitle { margin: 0 0 18px; color: var(--muted); max-width: 78ch; }
    .meta-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .meta { padding: 14px 16px; border: 1px solid var(--line); border-radius: 14px; background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(248,250,252,0.98)); }
    .meta-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); margin-bottom: 6px; }
    .meta-value { font-size: 19px; font-weight: 700; word-break: break-word; }
    .section { padding: 20px; margin-top: 18px; }
    .section h2 { margin: 0 0 12px; font-size: 20px; }
    .section p { margin: 0 0 14px; color: var(--muted); }
    .chart-grid { display: grid; gap: 18px; }
    .chart-card { padding: 16px; border: 1px solid var(--line); border-radius: 16px; background: #fff; }
    .chart-card img { width: 100%; height: auto; display: block; border-radius: 12px; }
    .table-wrap { overflow: auto; max-height: 620px; border: 1px solid var(--line); border-radius: 14px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    thead th {
      position: sticky;
      top: 0;
      z-index: 1;
      text-align: left;
      padding: 12px 10px;
      border-bottom: 1px solid var(--line);
      color: #334155;
      background: #f8fafc;
      white-space: nowrap;
    }
    tbody td { padding: 10px; border-bottom: 1px solid #e8eef5; vertical-align: top; }
    tbody tr:hover { background: #f8fafc; }
    .subtle { color: var(--muted); font-size: 13px; }
    @media (max-width: 1100px) {
      .hero, .meta-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <div class="panel hero-main">
        <span class="subtle">Phase 4 - ICD-10 Based Grounding Test</span>
        <h1>Concurrent ICD-10 Grounding Results</h1>
        <p class="subtitle">
          ${escapeHtml(runInfo.totalNurses)} nurse workflows were executed in parallel. The evaluation compares generated ICD-10 codes against patient-level references extracted from SOAP notes, clinical notes, and database diagnoses.
        </p>
        <div class="meta-grid">
          ${cards.map((card) => `
            <div class="meta">
              <div class="meta-label">${escapeHtml(card.label)}</div>
              <div class="meta-value">${escapeHtml(card.value)}</div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="panel hero-side">
        <div class="subtle">
          Source: <code>${escapeHtml(runInfo.sourceFile)}</code><br/>
          Total concurrent duration: <strong>${escapeHtml(formatLatency(runInfo.totalConcurrentDurationMs))}</strong><br/>
          Objective summary: <strong>N/A for ICD-10 grounding</strong>
        </div>
      </div>
    </div>

    <div class="panel section">
      <h2>Charts</h2>
      <p>Grounding, unsupported diagnosis, retrieval accuracy, and latency by stage.</p>
      <div class="chart-grid">
        <div class="chart-card"><img src="./phase4_icd10_grounding_accuracy.png" alt="ICD-10 Grounding Accuracy per Stage" /></div>
        <div class="chart-card"><img src="./phase4_unsupported_diagnosis_rate.png" alt="Unsupported Diagnosis Rate per Stage" /></div>
        <div class="chart-card"><img src="./phase4_icd10_retrieval_accuracy.png" alt="ICD-10 Retrieval Accuracy per Stage" /></div>
        <div class="chart-card"><img src="./phase4_concurrent_latency.png" alt="Average Latency per Stage" /></div>
      </div>
    </div>

    <div class="panel section">
      <h2>Stage Summary</h2>
      <p>Main table for the paper. Objective summary is shown as N/A because it does not produce diagnosis/ICD-10 grounded output.</p>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Stage</th>
              <th>Total Cases</th>
              <th>Diagnosis-Related Outputs</th>
              <th>Supported ICD-10 Outputs</th>
              <th>Unsupported Diagnosis</th>
              <th>ICD-10 Grounding Accuracy</th>
              <th>Unsupported Diagnosis Rate</th>
              <th>ICD-10 Retrieval Accuracy</th>
              <th>Missing ICD-10 Rate</th>
              <th>Wrong ICD-10 Rate</th>
              <th>Avg. Latency</th>
              <th>Triage Consistency Rate</th>
            </tr>
          </thead>
          <tbody>
            ${stageRows}
          </tbody>
        </table>
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function writeTextFile(filePath, content) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');
}

async function writeOutputs(rootOutputs) {
  await fs.writeFile(rootOutputs.json, JSON.stringify(rootOutputs.payload, null, 2), 'utf8');
  await fs.writeFile(rootOutputs.csv, rootOutputs.csvContent, 'utf8');
  await fs.writeFile(rootOutputs.md, rootOutputs.mdContent, 'utf8');
  await fs.writeFile(rootOutputs.tex, rootOutputs.texContent, 'utf8');
  await writePng(rootOutputs.groundingSvg, rootOutputs.groundingPng);
  await writePng(rootOutputs.unsupportedSvg, rootOutputs.unsupportedPng);
  await writePng(rootOutputs.retrievalSvg, rootOutputs.retrievalPng);
  await writePng(rootOutputs.latencySvg, rootOutputs.latencyPng);
  await fs.writeFile(rootOutputs.html, rootOutputs.htmlContent, 'utf8');
}

async function mirrorPhase4Files() {
  const files = [
    'phase4_icd10_concurrent_results.json',
    'phase4_icd10_concurrent_summary.csv',
    'phase4_icd10_concurrent_summary.md',
    'phase4_icd10_concurrent_table_latex.tex',
    'phase4_icd10_grounding_accuracy.png',
    'phase4_unsupported_diagnosis_rate.png',
    'phase4_icd10_retrieval_accuracy.png',
    'phase4_concurrent_latency.png',
    'phase4_icd10_concurrent_dashboard.html',
  ];

  for (const fileName of files) {
    await copyIfExists(path.join(RESULTS_DIR, fileName), path.join(PHASE4_DIR, fileName));
  }

  const readme = `# Phase 4 ICD-10 Concurrent Evaluation

This folder groups the live Phase 4 ICD-10 grounding outputs.

- \`phase4_icd10_concurrent_results.json\`: per nurse and per stage details
- \`phase4_icd10_concurrent_summary.csv\`: paper-ready numeric summary
- \`phase4_icd10_concurrent_summary.md\`: Markdown summary for reports
- \`phase4_icd10_concurrent_table_latex.tex\`: LaTeX table for papers
- \`phase4_icd10_grounding_accuracy.png\`: grounding accuracy chart
- \`phase4_unsupported_diagnosis_rate.png\`: unsupported diagnosis chart
- \`phase4_icd10_retrieval_accuracy.png\`: retrieval accuracy chart
- \`phase4_concurrent_latency.png\`: latency chart
- \`phase4_icd10_concurrent_dashboard.html\`: dashboard

Objective summary is shown as N/A for ICD-10 grounding.`;
  await writeTextFile(path.join(PHASE4_DIR, 'README.md'), readme);
}

async function runLogin(baseUrl, user) {
  return fetchJson(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: user.username, password: user.password }),
  });
}

async function runChat(baseUrl, sessionCookie, payload) {
  return fetchJson(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...getHeadersFromCookies([sessionCookie]),
    },
    body: JSON.stringify(payload),
  });
}

async function runClinicalNotes(baseUrl, sessionCookie, payload) {
  return fetchJson(`${baseUrl}/api/clinical-notes/generate`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...getHeadersFromCookies([sessionCookie]),
    },
    body: JSON.stringify(payload),
  });
}

function attachStageOutput(caseRow, stage, responseSummary, reference) {
  const base = {
    stageKey: stage.key,
    stageLabel: stage.label,
    route: stage.route,
    directEndpoint: stage.directEndpoint,
    status: responseSummary.status,
    ok: responseSummary.ok,
    latencyMs: responseSummary.latencyMs,
    error: responseSummary.error || null,
    referenceStatus: reference.referenceStatus,
    referenceIcd10Codes: reference.referenceIcd10Codes,
    referenceTriage: reference.referenceTriages[0] || null,
  };

  if (stage.key === 'generate') {
    const parsed = extractClinicalNoteResult(responseSummary);
    return {
      ...base,
      ...parsed,
      responseText: null,
      noteSummary: parsed.noteSummary || null,
      noteAssessment: parsed.noteAssessment || null,
    };
  }

  const parsed = extractChatResult(stage.key, responseSummary);
  return {
    ...base,
    ...parsed,
    responseText: responseSummary.message || responseSummary.text || null,
  };
}

function evaluateCase(caseRow, loginResult, stageResponses) {
  const payloads = buildPayloads(caseRow);
  const reference = buildReferenceCodes(caseRow);

  const stageResults = {};
  for (const stage of STAGES) {
    const responseSummary = stageResponses[stage.key];
    const stageOutput = attachStageOutput(caseRow, stage, responseSummary, reference);
    const evaluation = evaluateIcd10Case(stage, caseRow, reference, stageOutput);
    stageResults[stage.key] = {
      ...stageOutput,
      ...evaluation,
      payload: stage.key === 'summary' ? payloads.summary : stage.key === 'objective' ? payloads.objective : stage.key === 'update' ? payloads.update : payloads.generate,
    };
  }

  return {
    nurseUsername: caseRow.nurseUsername,
    nurseFullName: caseRow.nurseFullName,
    patientName: caseRow.patientName,
    noRm: caseRow.noRm,
    registrationId: caseRow.registrationId,
    doctorName: caseRow.doctorName,
    doctorSpecialization: caseRow.doctorSpecialization,
    login: {
      ok: loginResult.ok,
      status: loginResult.status,
      latencyMs: loginResult.latencyMs,
      body: loginResult.body && typeof loginResult.body === 'object' ? {
        message: loginResult.body.message || null,
        role: loginResult.body.role || null,
        redirectTo: loginResult.body.redirectTo || null,
      } : null,
    },
    stages: stageResults,
    referenceStatus: reference.referenceStatus,
    referenceIcd10Codes: reference.referenceIcd10Codes,
    referenceTriages: reference.referenceTriages,
  };
}

function withConcurrency(items, concurrency, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  }

  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, () => runWorker());
  return Promise.all(workers).then(() => results);
}

function buildAuditSummary(stageResults) {
  const totalResponses = stageResults.flatMap((item) => Object.values(item.stages || {}));
  return {
    totalResponses: totalResponses.length,
    successfulResponses: totalResponses.filter((item) => item.ok).length,
    totalStages: totalResponses.length,
  };
}

async function main() {
  await loadDotEnvIfNeeded();
  await ensureResultsDir();

  const args = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(args.baseUrl);
  const startedAt = new Date();
  const startedAtIso = startedAt.toISOString();

  const client = await connectDatabase();

  try {
    const cases = await loadTestCases(client, args.limit);
    if (cases.length === 0) {
      throw new Error('Tidak ada pasien/perawat dummy yang cocok untuk Phase 4.');
    }

    if (cases.length < args.limit) {
      console.warn(`Dataset hanya berisi ${cases.length} case, lebih kecil dari limit ${args.limit}.`);
    }

    const users = cases.map((caseRow) => {
      const fixture = NURSE_FIXTURES.find((item) => item.username.toLowerCase() === caseRow.nurseUsername.toLowerCase());
      if (!fixture) {
        throw new Error(`Password fixture untuk nurse ${caseRow.nurseUsername} tidak ditemukan.`);
      }
      return {
        ...caseRow,
        username: caseRow.nurseUsername,
        password: fixture.password,
      };
    });

    if (args.dryRun) {
      console.log(`Dry run only. Base URL: ${baseUrl}`);
      console.table(users.map((row) => ({
        nurse: row.nurseUsername,
        patient: row.patientName,
        noRm: row.noRm,
        registrationId: row.registrationId,
        doctor: row.doctorName,
      })));
      return;
    }

    console.log(`Phase 4 ICD-10 concurrent test dimulai untuk ${users.length} perawat pada ${baseUrl}`);

    const workflowResults = await withConcurrency(users, args.concurrency, async (caseRow, index) => {
      const workflowStartedAt = Date.now();
      const stageResponses = {};

      const login = await runLogin(baseUrl, { username: caseRow.username, password: caseRow.password });
      const loginSetCookie = login.setCookies || [];
      const rawSetCookie = loginSetCookie.join(', ');
      const cookieMatch = rawSetCookie.match(/(?:^|,\s*)darsi_nurse_session=([^;]+)/);
      const sessionCookie = cookieMatch ? cookieMatch[1] : null;

      if (!login.ok || !sessionCookie) {
        const failedResponses = {};
        for (const stage of STAGES) {
          failedResponses[stage.key] = {
            ok: false,
            status: stage.key === 'generate' ? 201 : 401,
            latencyMs: 0,
            text: null,
            body: null,
            message: null,
            error: 'login_failed',
          };
        }
        const result = evaluateCase(caseRow, login, failedResponses);
        return {
          ...result,
          startedAt: new Date(workflowStartedAt).toISOString(),
          finishedAt: new Date().toISOString(),
          durationMs: Date.now() - workflowStartedAt,
        };
      }

      const summaryResponse = summarizeResponse(await runChat(baseUrl, sessionCookie, buildPayloads(caseRow).summary));
      stageResponses.summary = summaryResponse;

      const objectiveResponse = summarizeResponse(await runChat(baseUrl, sessionCookie, buildPayloads(caseRow).objective));
      stageResponses.objective = objectiveResponse;

      const updateResponse = summarizeResponse(await runChat(baseUrl, sessionCookie, buildStageUpdatePayload(caseRow)));
      stageResponses.update = updateResponse;

      const generateResponse = summarizeResponse(await runClinicalNotes(baseUrl, sessionCookie, buildPayloads(caseRow).generate));
      stageResponses.generate = generateResponse;

      const result = evaluateCase(caseRow, login, stageResponses);
      return {
        ...result,
        startedAt: new Date(workflowStartedAt).toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - workflowStartedAt,
      };
    });

    const finishedAt = new Date();
    const caseResultsByStage = {
      summary: workflowResults.map((item) => item.stages.summary),
      objective: workflowResults.map((item) => item.stages.objective),
      update: workflowResults.map((item) => item.stages.update),
      generate: workflowResults.map((item) => item.stages.generate),
    };

    const stageSummaries = STAGES.map((stage) => aggregateStage(stage, caseResultsByStage[stage.key]));
    const overallSummary = aggregateOverall(stageSummaries, caseResultsByStage);
    const totalConcurrentDurationMs = finishedAt.getTime() - startedAt.getTime();
    const totalCases = workflowResults.length * STAGES.length;

    const runInfo = {
      startedAt: startedAtIso,
      finishedAt: finishedAt.toISOString(),
      totalConcurrentDurationMs,
      totalNurses: workflowResults.length,
      totalCases,
      baseUrl,
      sourceFile: 'evaluation/results/phase4_icd10_concurrent_results.json',
    };

    const summaryParagraph = [
      `The Phase 4 ICD-10 grounding test was executed across ${workflowResults.length} nurse workflows in parallel.`,
      `Clinical summary, update kondisi pasien, and generate clinical notes were evaluated for ICD-10 grounding, while objective summary was treated as N/A because it does not consistently return diagnosis-grounded ICD output.`,
      `Across all diagnosis-related outputs, grounding accuracy was ${formatPercent(overallSummary.groundingAccuracy)}, unsupported diagnosis rate was ${formatPercent(overallSummary.unsupportedDiagnosisRate)}, and retrieval accuracy was ${formatPercent(overallSummary.retrievalAccuracy)}.`,
      `The concurrent run completed in ${formatLatency(totalConcurrentDurationMs)}.`,
    ].join(' ');

    const groundingSvg = buildSvgBarChart({
      title: 'ICD-10 Grounding Accuracy per Stage',
      subtitle: 'Objective summary is shown as N/A because it is not diagnosis-grounded.',
      labels: stageSummaries.map((stage) => stage.label),
      values: stageSummaries.map((stage) => (stage.icdRelevant ? stage.groundingAccuracy : null)),
      unit: '%',
      maxValue: 100,
      color: '#0f766e',
    });

    const unsupportedSvg = buildSvgBarChart({
      title: 'Unsupported Diagnosis Rate per Stage',
      subtitle: 'Objective summary remains N/A for ICD-10 evaluation.',
      labels: stageSummaries.map((stage) => stage.label),
      values: stageSummaries.map((stage) => (stage.icdRelevant ? stage.unsupportedDiagnosisRate : null)),
      unit: '%',
      maxValue: 100,
      color: '#dc2626',
    });

    const retrievalSvg = buildSvgBarChart({
      title: 'ICD-10 Retrieval Accuracy per Stage',
      subtitle: 'Objective summary remains N/A for ICD-10 evaluation.',
      labels: stageSummaries.map((stage) => stage.label),
      values: stageSummaries.map((stage) => (stage.icdRelevant ? stage.retrievalAccuracy : null)),
      unit: '%',
      maxValue: 100,
      color: '#2563eb',
    });

    const latencySvg = buildSvgBarChart({
      title: 'Average Latency per Stage',
      subtitle: 'Latency in milliseconds for each workflow stage.',
      labels: stageSummaries.map((stage) => stage.label),
      values: stageSummaries.map((stage) => stage.avgLatencyMs),
      unit: 'ms',
      color: '#7c3aed',
    });

    const outputPayload = {
      generatedAt: finishedAt.toISOString(),
      startedAt: startedAtIso,
      finishedAt: finishedAt.toISOString(),
      totalConcurrentDurationMs,
      baseUrl,
      totalNurses: workflowResults.length,
      totalCases,
      overallSummary,
      stageSummaries,
      users: workflowResults.map((item) => ({
        nurseUsername: item.nurseUsername,
        nurseFullName: item.nurseFullName,
        patientName: item.patientName,
        noRm: item.noRm,
        registrationId: item.registrationId,
        doctorName: item.doctorName,
        doctorSpecialization: item.doctorSpecialization,
        startedAt: item.startedAt,
        finishedAt: item.finishedAt,
        durationMs: item.durationMs,
        referenceStatus: item.referenceStatus,
        referenceIcd10Codes: item.referenceIcd10Codes,
        referenceTriages: item.referenceTriages,
        login: item.login,
        stages: item.stages,
      })),
      notes: {
        objectiveSummary: 'N/A for ICD-10 grounding.',
      },
    };

    const mdContent = `# Phase 4 ICD-10 Concurrent Evaluation\n\n${summaryParagraph}\n\n${buildMarkdownTable(stageSummaries)}\n`;
    const csvContent = buildCsv(stageSummaries);
    const texContent = buildLatexTable(stageSummaries);
    const htmlContent = buildDashboardHtml({ runInfo, stageSummaries, overallSummary });

    const outputFiles = {
      json: path.join(RESULTS_DIR, 'phase4_icd10_concurrent_results.json'),
      csv: path.join(RESULTS_DIR, 'phase4_icd10_concurrent_summary.csv'),
      md: path.join(RESULTS_DIR, 'phase4_icd10_concurrent_summary.md'),
      tex: path.join(RESULTS_DIR, 'phase4_icd10_concurrent_table_latex.tex'),
      groundingPng: path.join(RESULTS_DIR, 'phase4_icd10_grounding_accuracy.png'),
      unsupportedPng: path.join(RESULTS_DIR, 'phase4_unsupported_diagnosis_rate.png'),
      retrievalPng: path.join(RESULTS_DIR, 'phase4_icd10_retrieval_accuracy.png'),
      latencyPng: path.join(RESULTS_DIR, 'phase4_concurrent_latency.png'),
      html: path.join(RESULTS_DIR, 'phase4_icd10_concurrent_dashboard.html'),
    };

    await writeOutputs({
      payload: outputPayload,
      csvContent,
      mdContent,
      texContent,
      groundingSvg,
      unsupportedSvg,
      retrievalSvg,
      latencySvg,
      groundingPng: outputFiles.groundingPng,
      unsupportedPng: outputFiles.unsupportedPng,
      retrievalPng: outputFiles.retrievalPng,
      latencyPng: outputFiles.latencyPng,
      json: outputFiles.json,
      csv: outputFiles.csv,
      md: outputFiles.md,
      tex: outputFiles.tex,
      html: outputFiles.html,
      htmlContent,
    });

    await mirrorPhase4Files();

    const auditSummary = buildAuditSummary(workflowResults);
    console.log(`Phase 4 ICD-10 concurrent evaluation complete.`);
    console.log(`Input base URL: ${baseUrl}`);
    console.log(`Total nurses: ${runInfo.totalNurses}`);
    console.log(`Total cases: ${runInfo.totalCases}`);
    console.log(`Total concurrent duration: ${formatLatency(totalConcurrentDurationMs)}`);
    console.log(`Grounding accuracy: ${formatPercent(overallSummary.groundingAccuracy)}`);
    console.log(`Retrieval accuracy: ${formatPercent(overallSummary.retrievalAccuracy)}`);
    console.log(`Triage consistency: ${formatPercent(overallSummary.triageConsistencyRate)}`);
    console.log(`Audit responses recorded: ${auditSummary.totalResponses}`);
    console.log(`Objective summary is treated as N/A for ICD-10 grounding.`);
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
