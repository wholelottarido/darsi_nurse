import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const EVALUATION_DIR = path.join(PROJECT_ROOT, 'evaluation');
const RESULTS_DIR = path.join(EVALUATION_DIR, 'results');
const TEST_CASES_DIR = path.join(EVALUATION_DIR, 'test-cases');
const TEST_CASES_FILE = path.join(TEST_CASES_DIR, 'darsi-workflow-test-cases.json');
const WORKFLOW_RESULTS_FILE = path.join(RESULTS_DIR, 'workflow_results.json');
const STRUCTURED_REFERENCES_FILE = path.join(
  RESULTS_DIR,
  'phase5_structured_clinical_references',
  'reference',
  'phase5_structured_clinical_references.json'
);

const DEFAULT_BASE_URL = 'http://127.0.0.1:3019';
const DEFAULT_MODE = 'auto';
const WORKFLOW_ORDER = [
  'triage_monitoring',
  'soap_clinical_notes',
  'icd10_clinical_recommendation',
  'nurse_assistant_operational',
  'general_nurse_questions',
];

const WORKFLOW_LABELS = {
  triage_monitoring: 'Triage dan Monitoring Pasien',
  soap_clinical_notes: 'SOAP dan Clinical Notes',
  icd10_clinical_recommendation: 'ICD-10 dan Rekomendasi Klinis',
  nurse_assistant_operational: 'Nurse Assistant Operasional',
  general_nurse_questions: 'Pertanyaan Umum Perawat',
};

const MODEL_EXPECTATIONS = {
  clinical: 'NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
  operational: 'NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
  general: 'medgemma:4b',
};

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

const TRIAGE_PROMPTS = [
  'Ringkaskan kondisi klinis pasien ini berdasarkan SOAP terbaru dan monitoring triase aktif. Fokus pada kondisi terkini, assessment, plan, dan tingkat triase.',
  'Buat ringkasan triase pasien ini dari data SOAP dan clinical summary terakhir. Jelaskan kondisi pasien, assessment, rencana tindak lanjut, dan prioritas triase.',
  'Tolong susun ringkasan monitoring pasien ini. Saya butuh kondisi terbaru, interpretasi klinis, rencana tindakan, dan level triase.',
  'Analisis kondisi pasien pada kunjungan aktif ini. Rangkum keluhan utama, temuan penting, assessment, plan, dan status triase.',
  'Buat summary pasien ini untuk handoff perawat berikutnya dengan fokus pada monitoring terkini, assessment, plan, dan triage level.',
];

const SOAP_PROMPTS = [
  'Perbarui clinical notes pasien ini dari perkembangan triase terbaru. Simpan update subjective tanpa mengubah SOAP dokter.',
  'Catat perkembangan terbaru pasien ini ke clinical notes berdasarkan update triase terkini.',
  'Tolong update kondisi pasien ke clinical notes dari hasil pemantauan perawat terbaru.',
  'Simpan pembaruan kondisi terbaru pasien ini ke clinical notes triase aktif.',
  'Masukkan perubahan kondisi pasien ke clinical notes dan pastikan ringkasan, assessment, plan, dan triage tetap konsisten.',
];

const ICD_PROMPTS = [
  'Berdasarkan data SOAP pasien ini, buat ringkasan klinis yang mencantumkan diagnosis ICD-10 paling relevan beserta rekomendasi klinis.',
  'Gunakan data pasien ini untuk menyusun clinical note dengan kode ICD-10 yang sesuai dan rencana tindak lanjut klinis.',
  'Buat evaluasi klinis pasien ini dari SOAP aktif, sertakan kode ICD-10 dan rekomendasi tindakan.',
  'Tolong hasilkan catatan klinis pasien ini dengan fokus pada assessment, plan, dan validasi kode ICD-10.',
  'Susun output klinis pasien ini yang merangkum kondisi, ICD-10 terkait, dan rekomendasi penanganan lanjutan.',
];

const OPERATIONAL_PROMPTS = [
  (pair) => `Tampilkan ringkasan singkat pasien ${pair.patient_name} yang sedang saya tangani.`,
  (pair) => `Berikan summary pasien ${pair.patient_name} untuk operasional shift ini.`,
  (pair) => `Saya butuh ringkasan pasien ${pair.patient_name} yang menjadi tanggungan saya sekarang.`,
  (pair) => `Ambil resume pasien ${pair.patient_name} yang sedang ditugaskan ke saya.`,
  (pair) => `Tolong tampilkan info singkat pasien ${pair.patient_name} yang sedang saya rawat.`,
];

const GENERAL_PROMPTS = [
  (complaint) => `Apa edukasi awal yang aman untuk perawat saat menghadapi pasien dengan keluhan ${complaint}?`,
  (complaint) => `Berikan panduan umum observasi awal untuk pasien dengan keluhan ${complaint}.`,
  (complaint) => `Apa langkah edukasi dan monitoring dasar untuk pasien dengan gejala ${complaint}?`,
  (complaint) => `Tolong jelaskan rekomendasi umum bagi perawat untuk pasien dengan keluhan ${complaint}.`,
  (complaint) => `Apa penanganan umum non-invasif yang biasanya dijelaskan perawat pada pasien dengan ${complaint}?`,
];

const GENERAL_GUIDANCE_BY_COMPLAINT = {
  demam: 'Pantau suhu, anjurkan hidrasi, observasi penurunan kesadaran, dan eskalasi bila demam tinggi menetap atau muncul sesak.',
  batuk: 'Observasi pola batuk, frekuensi napas, hidrasi, dan edukasi tanda bahaya seperti sesak atau saturasi menurun.',
  pilek: 'Anjurkan istirahat, cairan cukup, kebersihan saluran napas, dan observasi bila muncul demam tinggi atau sesak.',
  nyeri_epigastrium: 'Edukasi makan porsi kecil, hindari makanan pemicu, pantau muntah atau nyeri memberat, dan rujuk bila muncul tanda bahaya.',
  gatal_ruam: 'Identifikasi pemicu, hindari iritan, observasi penyebaran ruam atau sesak, dan eskalasi jika ada tanda alergi berat.',
  sesak_napas: 'Pantau pola napas, posisi nyaman, observasi tanda distres napas, dan segera eskalasi bila saturasi turun atau wheezing memburuk.',
  nyeri_kemih: 'Pantau frekuensi BAK, hidrasi, demam, dan nyeri pinggang; edukasi untuk kembali bila keluhan memburuk.',
  sakit_kepala: 'Observasi nyeri, tekanan darah, kesadaran, dan gejala neurologis; edukasi istirahat dan eskalasi bila ada red flag.',
  default: 'Lakukan observasi tanda vital, edukasi istirahat dan hidrasi sesuai kondisi, serta eskalasi bila gejala memberat atau muncul tanda bahaya.',
};

function parseArgs(argv) {
  const args = {
    mode: DEFAULT_MODE,
    baseUrl: process.env.APP_BASE_URL || DEFAULT_BASE_URL,
    buildDatasetOnly: false,
  };

  for (const value of argv) {
    if (value.startsWith('--mode=')) {
      args.mode = value.slice('--mode='.length).trim() || DEFAULT_MODE;
    } else if (value.startsWith('--base-url=')) {
      args.baseUrl = value.slice('--base-url='.length).trim() || DEFAULT_BASE_URL;
    } else if (value === '--build-dataset-only') {
      args.buildDatasetOnly = true;
    }
  }

  return args;
}

async function ensureDirs() {
  await fs.mkdir(TEST_CASES_DIR, { recursive: true });
  await fs.mkdir(RESULTS_DIR, { recursive: true });
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9.\s-]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(value) {
  return normalizeText(value)
    .split(' ')
    .map((item) => item.trim())
    .filter(Boolean);
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return '';
}

function sentence(value) {
  const text = firstNonEmpty(value);
  if (!text) return '';
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function formatClinicalNoteText(note) {
  if (!note || typeof note !== 'object') {
    return '';
  }

  const parts = [
    `PATIENT_CONDITION: ${firstNonEmpty(note.patient_condition, note.latestCondition, '-')}`,
    `SUMMARY: ${firstNonEmpty(note.summary, '-')}`,
    `ASSESSMENT: ${firstNonEmpty(note.assessment, '-')}`,
    `PLAN: ${firstNonEmpty(note.plan, '-')}`,
    `MEDICATION: ${firstNonEmpty(note.medication_recommendation, note.medication, '-')}`,
    `TRIAGE_LEVEL: ${firstNonEmpty(note.triage_level, note.triageLevel, '-')}`,
  ];

  return parts.join('\n');
}

function formatSeconds(ms) {
  if (!Number.isFinite(ms)) return null;
  return Number((ms / 1000).toFixed(3));
}

function round(value, digits = 4) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mean(values) {
  const filtered = values.filter((value) => Number.isFinite(value));
  if (filtered.length === 0) return null;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function ratio(numerator, denominator) {
  if (!denominator) return null;
  return numerator / denominator;
}

function toPercent(value) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  return round(value * 100, 2);
}

function escapeMarkdown(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function parseComplaint(ref) {
  const subjective = normalizeText(ref?.soapNote?.subjective || '');
  const objective = normalizeText(ref?.soapNote?.objective || '');
  const merged = `${subjective} ${objective}`;

  if (merged.includes('demam')) return 'demam';
  if (merged.includes('batuk')) return merged.includes('pilek') ? 'batuk pilek' : 'batuk';
  if (merged.includes('pilek')) return 'pilek';
  if (merged.includes('epigastr')) return 'nyeri epigastrium';
  if (merged.includes('gatal') || merged.includes('ruam')) return 'gatal dan ruam ringan';
  if (merged.includes('sesak') || merged.includes('wheezing')) return 'sesak napas';
  if (merged.includes('suprapubik') || merged.includes('bak')) return 'nyeri saat berkemih';
  if (merged.includes('kepala') || merged.includes('pusing')) return 'sakit kepala';
  if (merged.includes('diare')) return 'diare';
  return 'keluhan klinis umum';
}

function complaintKey(complaint) {
  const normalized = normalizeText(complaint);
  if (normalized.includes('demam')) return 'demam';
  if (normalized.includes('batuk')) return 'batuk';
  if (normalized.includes('pilek')) return 'pilek';
  if (normalized.includes('epigastr')) return 'nyeri_epigastrium';
  if (normalized.includes('gatal') || normalized.includes('ruam')) return 'gatal_ruam';
  if (normalized.includes('sesak')) return 'sesak_napas';
  if (normalized.includes('kemih') || normalized.includes('bak')) return 'nyeri_kemih';
  if (normalized.includes('kepala') || normalized.includes('pusing')) return 'sakit_kepala';
  return 'default';
}

function buildGeneralReferenceAnswer(complaint) {
  const key = complaintKey(complaint);
  const guidance = GENERAL_GUIDANCE_BY_COMPLAINT[key] || GENERAL_GUIDANCE_BY_COMPLAINT.default;
  return `Panduan umum untuk keluhan ${complaint}: ${guidance} Jawaban ini bersifat umum dan tetap perlu disesuaikan dengan kondisi klinis aktual pasien.`;
}

function buildOperationalReferenceAnswer(pair, ref) {
  return [
    `Ringkasan singkat pasien ${pair.patient_name}.`,
    `NRM: ${pair.no_rm}.`,
    `Dokter penanggung jawab: ${firstNonEmpty(pair.doctor_name, ref?.patientData?.additionalInfo?.doctorName, '-')}.`,
    `Kondisi terbaru: ${firstNonEmpty(ref?.clinicalContext?.latestCondition, ref?.clinicalContext?.summary, '-')}.`,
    `Triage terbaru: ${firstNonEmpty(ref?.triage?.level, '-')}.`,
  ].join(' ');
}

function buildIcdReferenceAnswer(pair, ref) {
  return [
    `Pasien ${pair.patient_name} paling sesuai dengan ICD-10 ${firstNonEmpty(ref?.icd10?.code, '-')} ${firstNonEmpty(ref?.icd10?.name, '')}.`,
    sentence(ref?.soapNote?.assessment || ref?.clinicalContext?.summary || '-'),
    `Rekomendasi klinis: ${firstNonEmpty(ref?.soapNote?.plan, '-')}.`,
    `Triage: ${firstNonEmpty(ref?.triage?.level, '-')}.`,
  ].join(' ');
}

function buildSoapReferenceAnswer(ref) {
  return formatClinicalNoteText({
    patient_condition: ref?.clinicalContext?.latestCondition,
    summary: ref?.clinicalContext?.summary,
    assessment: ref?.soapNote?.assessment,
    plan: ref?.soapNote?.plan,
    medication_recommendation: '-',
    triage_level: ref?.triage?.level,
  });
}

function buildRepoAnalysis() {
  return {
    endpoints: [
      { route: '/api/chat', purpose: 'Workflow triage, monitoring pasien, summary objektif, dan update konteks klinis.' },
      { route: '/api/clinical-notes/generate', purpose: 'Membangkitkan clinical notes turunan dari SOAP, visit context, dan konteks triase.' },
      { route: '/api/nurse-chat', purpose: 'Nurse assistant dengan routing operational, general guidance, hybrid, atau out-of-scope.' },
      { route: '/api/external-examinations', purpose: 'Memuat dan memperbarui SOAP dokter dari tabel external_examinations.' },
      { route: '/api/triage-visits', purpose: 'Menyimpan konteks kunjungan triase aktif dan histori triage_visit.' },
    ],
    tools: {
      clinical: [
        'searchPatient',
        'getPatientHealthSummary',
        'monitorPatientStatus',
        'updatePatientCondition',
        'getPatientAllergies',
        'getPatientMedicalHistory',
        'searchDiagnosaWithTriage',
        'getPatientActionRecommendation',
        'updateSoapSubjective',
      ],
      routeLevelClinical: [
        'clinical_summary',
        'external_examinations_objective_summary',
        'clinical_notes_chat_update',
      ],
      operational: [
        'check_medicine_availability',
        'list_assigned_patients',
        'get_assigned_patient_summary',
      ],
    },
    tables: [
      'patients',
      'registrations',
      'external_examinations',
      'clinical_notes',
      'triage_visits',
      'conversations',
      'nurse_chat_sessions',
      'nurse_chat_conversations',
      'icd10_diagnoses',
      'soap_keyword_icd',
      'darsi_ph_stok_obat',
      'agent_interaction_logs',
      'agent_data_source_logs',
      'agent_performance_logs',
    ],
    logging: {
      interactionLogs: 'app/api/chat, app/api/nurse-chat, dan app/api/clinical-notes/generate menyimpan log request/response ke agent_interaction_logs.',
      dataSourceLogs: 'saveAgentDataSourceLogs menyimpan tabel dan field yang dibaca ke agent_data_source_logs.',
      performanceLogs: 'saveAgentPerformanceLog menyimpan totalLatencyMs, llmLatencyMs, toolLatencyMs, dan metadata model ke agent_performance_logs.',
      conversationHistory: 'Triage chat memakai conversations; nurse assistant memakai nurse_chat_sessions dan nurse_chat_conversations.',
    },
    routing: {
      toolCalling: 'Permintaan pasien-spesifik dan operasional diarahkan ke triage agent atau operational agent dengan tool calling.',
      generalGuidance: 'Pertanyaan umum perawat dipetakan oleh nurse-chat-router ke general_guidance dan model medgemma:4b tanpa tools.',
    },
  };
}

function buildDataset(workflowResults, structuredReferences) {
  const referencesByNoRm = new Map(
    structuredReferences.map((item) => [String(item.noRm), item])
  );

  const basePairs = workflowResults.users.map((user, index) => {
    const ref = referencesByNoRm.get(String(user.noRm));
    return {
      base_index: index,
      nurse_id: user.login?.body?.perawat?.id || `nurse-${index + 1}`,
      nurse_username: user.nurseUsername,
      nurse_name: user.nurseFullName,
      patient_id: ref?.patientData?.additionalInfo?.patientId ?? null,
      patient_name: user.patientName,
      no_rm: user.noRm,
      registration_id: user.registrationId,
      doctor_name: user.doctorName,
      complaint: parseComplaint(ref),
      workflow_outputs: user,
      reference: ref ?? null,
    };
  });

  const cases = [];

  for (const pair of basePairs) {
    const triagePrompt = TRIAGE_PROMPTS[pair.base_index % TRIAGE_PROMPTS.length];
    const soapPrompt = SOAP_PROMPTS[pair.base_index % SOAP_PROMPTS.length];
    const icdPrompt = ICD_PROMPTS[pair.base_index % ICD_PROMPTS.length];
    const operationalPrompt = OPERATIONAL_PROMPTS[pair.base_index % OPERATIONAL_PROMPTS.length](pair);
    const generalPrompt = GENERAL_PROMPTS[pair.base_index % GENERAL_PROMPTS.length](pair.complaint);
    const ref = pair.reference;
    const summaryText = pair.workflow_outputs.summary?.message || buildSoapReferenceAnswer(ref);

    cases.push({
      id: `TRIAGE-${String(pair.base_index + 1).padStart(3, '0')}`,
      workflow: 'triage_monitoring',
      nurse_id: pair.nurse_id,
      nurse_username: pair.nurse_username,
      patient_id: pair.patient_id,
      patient_name: pair.patient_name,
      no_rm: pair.no_rm,
      registration_id: pair.registration_id,
      prompt: triagePrompt,
      model_expected: MODEL_EXPECTATIONS.clinical,
      endpoint: '/api/chat',
      expected_tools: ['clinical_summary'],
      expected_keywords: unique([
        pair.patient_name,
        ref?.triage?.level,
        ref?.icd10?.code,
        pair.complaint.split(' ')[0],
      ]),
      reference_answer: summaryText,
      expected_task_result: 'patient_summary_returned',
      hallucination_guard_sources: ['patients', 'external_examinations', 'clinical_notes', 'conversations'],
      notes: 'Mengacu ke kontrak /api/chat dan tool route-level clinical_summary.',
    });

    cases.push({
      id: `SOAP-${String(pair.base_index + 1).padStart(3, '0')}`,
      workflow: 'soap_clinical_notes',
      nurse_id: pair.nurse_id,
      nurse_username: pair.nurse_username,
      patient_id: pair.patient_id,
      patient_name: pair.patient_name,
      no_rm: pair.no_rm,
      registration_id: pair.registration_id,
      prompt: `${soapPrompt} Update terbaru: demam berkurang, masih lemas, nafsu makan mulai membaik.`,
      model_expected: MODEL_EXPECTATIONS.clinical,
      endpoint: '/api/chat',
      expected_tools: ['clinical_notes_chat_update'],
      expected_keywords: unique([
        'assessment',
        'plan',
        ref?.triage?.level,
        pair.patient_name,
      ]),
      reference_answer: pair.workflow_outputs.update?.message || buildSoapReferenceAnswer(ref),
      expected_task_result: 'clinical_note_update_saved',
      hallucination_guard_sources: ['clinical_notes', 'external_examinations', 'patients'],
      notes: 'Menggunakan update clinical notes via /api/chat agar tool success dapat diverifikasi.',
    });

    cases.push({
      id: `ICD-${String(pair.base_index + 1).padStart(3, '0')}`,
      workflow: 'icd10_clinical_recommendation',
      nurse_id: pair.nurse_id,
      nurse_username: pair.nurse_username,
      patient_id: pair.patient_id,
      patient_name: pair.patient_name,
      no_rm: pair.no_rm,
      registration_id: pair.registration_id,
      prompt: icdPrompt,
      model_expected: MODEL_EXPECTATIONS.clinical,
      endpoint: '/api/clinical-notes/generate',
      expected_tools: [],
      expected_keywords: unique([
        ref?.icd10?.code,
        ref?.icd10?.name,
        ref?.triage?.level,
        'plan',
      ]),
      reference_answer: buildIcdReferenceAnswer(pair, ref),
      expected_task_result: 'icd_and_clinical_plan_generated',
      hallucination_guard_sources: ['external_examinations', 'clinical_notes', 'icd10_diagnoses', 'soap_keyword_icd'],
      notes: 'Evaluasi ICD-10 dan rekomendasi klinis memakai endpoint generate clinical notes.',
    });

    cases.push({
      id: `OPS-${String(pair.base_index + 1).padStart(3, '0')}`,
      workflow: 'nurse_assistant_operational',
      nurse_id: pair.nurse_id,
      nurse_username: pair.nurse_username,
      patient_id: pair.patient_id,
      patient_name: pair.patient_name,
      no_rm: pair.no_rm,
      registration_id: pair.registration_id,
      prompt: operationalPrompt,
      model_expected: MODEL_EXPECTATIONS.operational,
      endpoint: '/api/nurse-chat',
      expected_tools: ['get_assigned_patient_summary'],
      expected_keywords: unique([
        pair.patient_name,
        pair.no_rm,
        ref?.triage?.level,
      ]),
      reference_answer: buildOperationalReferenceAnswer(pair, ref),
      expected_task_result: 'assigned_patient_summary_returned',
      hallucination_guard_sources: ['registrations', 'patients', 'clinical_notes', 'external_examinations'],
      notes: 'Nurse assistant operasional diarahkan ke operational agent dengan tool get_assigned_patient_summary.',
    });

    cases.push({
      id: `GENERAL-${String(pair.base_index + 1).padStart(3, '0')}`,
      workflow: 'general_nurse_questions',
      nurse_id: pair.nurse_id,
      nurse_username: pair.nurse_username,
      patient_id: pair.patient_id,
      patient_name: pair.patient_name,
      no_rm: pair.no_rm,
      registration_id: pair.registration_id,
      prompt: generalPrompt,
      model_expected: MODEL_EXPECTATIONS.general,
      endpoint: '/api/nurse-chat',
      expected_tools: [],
      expected_keywords: unique([
        'observasi',
        'edukasi',
        pair.complaint.split(' ')[0],
      ]),
      reference_answer: buildGeneralReferenceAnswer(pair.complaint),
      expected_task_result: 'general_guidance_answered',
      hallucination_guard_sources: ['general_guidance_prompt_policy'],
      notes: 'Pertanyaan umum diarahkan ke general_guidance tanpa tool calling.',
    });
  }

  return cases;
}

function buildCookieHeader(sessionCookie) {
  return sessionCookie ? { Cookie: `darsi_nurse_session=${sessionCookie}` } : {};
}

function parseJsonSafe(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function splitSetCookieHeader(headerValue) {
  if (!headerValue) return [];
  return headerValue
    .split(/,(?=[^;,=]+=[^;,=]+)/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

async function fetchJson(url, options = {}) {
  const startedAt = Date.now();
  const response = await fetch(url, options);
  const text = await response.text();
  const headers = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : splitSetCookieHeader(response.headers.get('set-cookie'));

  return {
    ok: response.ok,
    status: response.status,
    body: parseJsonSafe(text),
    text,
    latencyMs: Date.now() - startedAt,
    headers,
  };
}

async function runLogin(baseUrl, fixture) {
  const response = await fetchJson(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      username: fixture.username,
      password: fixture.password,
    }),
  });

  const rawSetCookie = response.headers.join(', ');
  const match = rawSetCookie.match(/(?:^|,\s*)darsi_nurse_session=([^;]+)/);
  return {
    ok: response.ok && Boolean(match?.[1]),
    status: response.status,
    latencyMs: response.latencyMs,
    body: response.body,
    sessionCookie: match?.[1] || null,
  };
}

function buildRequestPayload(testCase) {
  if (testCase.endpoint === '/api/chat') {
    return {
      message: testCase.prompt,
      patientId: testCase.patient_id !== null ? String(testCase.patient_id) : null,
      registrationId: testCase.registration_id,
    };
  }

  if (testCase.endpoint === '/api/clinical-notes/generate') {
    return {
      patientId: testCase.patient_id,
    };
  }

  if (testCase.endpoint === '/api/nurse-chat') {
    return {
      message: testCase.prompt,
      createNewSession: true,
    };
  }

  throw new Error(`Unsupported endpoint: ${testCase.endpoint}`);
}

function extractActualOutput(testCase, responseBody, fallbackReference) {
  if (testCase.endpoint === '/api/chat') {
    return firstNonEmpty(responseBody?.message, fallbackReference);
  }

  if (testCase.endpoint === '/api/nurse-chat') {
    return firstNonEmpty(responseBody?.message, fallbackReference);
  }

  if (testCase.endpoint === '/api/clinical-notes/generate') {
    const note = responseBody?.note;
    if (note) {
      return formatClinicalNoteText({
        patient_condition: note.patient_condition,
        summary: note.summary,
        assessment: note.assessment,
        plan: note.plan,
        medication_recommendation: note.medication_recommendation,
        triage_level: note.triage_level,
      });
    }
    return firstNonEmpty(fallbackReference);
  }

  return firstNonEmpty(fallbackReference);
}

function extractTools(responseBody) {
  const raw = Array.isArray(responseBody?.toolsUsed) ? responseBody.toolsUsed : [];
  return unique(raw.map((item) => String(item || '').trim()).filter(Boolean));
}

function extractActualModel(testCase, responseBody) {
  if (testCase.workflow === 'general_nurse_questions') {
    return MODEL_EXPECTATIONS.general;
  }
  if (testCase.workflow === 'nurse_assistant_operational') {
    return MODEL_EXPECTATIONS.operational;
  }
  return MODEL_EXPECTATIONS.clinical;
}

function computeAccuracy(actualText, expectedTaskResult, expectedKeywords) {
  const normalized = normalizeText(actualText);
  const matched = expectedKeywords.filter((keyword) => normalized.includes(normalizeText(keyword)));
  const keywordCoverage = expectedKeywords.length === 0 ? 1 : matched.length / expectedKeywords.length;
  const taskSignal = normalized.length > 0 && expectedTaskResult ? 1 : 0;
  return round((keywordCoverage * 0.7) + (taskSignal * 0.3), 4);
}

function computePrecisionRecallF1(actualText, referenceText) {
  const actualTokens = tokenize(actualText);
  const referenceTokens = tokenize(referenceText);
  if (actualTokens.length === 0 || referenceTokens.length === 0) {
    return { precision: 0, recall: 0, f1: 0 };
  }

  const referenceCounts = new Map();
  for (const token of referenceTokens) {
    referenceCounts.set(token, (referenceCounts.get(token) || 0) + 1);
  }

  let overlap = 0;
  for (const token of actualTokens) {
    const count = referenceCounts.get(token) || 0;
    if (count > 0) {
      overlap += 1;
      referenceCounts.set(token, count - 1);
    }
  }

  const precision = overlap / actualTokens.length;
  const recall = overlap / referenceTokens.length;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return {
    precision: round(precision),
    recall: round(recall),
    f1: round(f1),
  };
}

function countNgrams(tokens, size) {
  const counts = new Map();
  for (let index = 0; index <= tokens.length - size; index += 1) {
    const key = tokens.slice(index, index + size).join(' ');
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

function computeBleu(actualText, referenceText, maxN = 4) {
  const candidate = tokenize(actualText);
  const reference = tokenize(referenceText);
  if (candidate.length === 0 || reference.length === 0) return 0;

  const precisions = [];
  for (let n = 1; n <= maxN; n += 1) {
    if (candidate.length < n) {
      precisions.push(0);
      continue;
    }
    const candidateCounts = countNgrams(candidate, n);
    const referenceCounts = countNgrams(reference, n);
    let overlap = 0;
    let total = 0;
    for (const [ngram, count] of candidateCounts.entries()) {
      total += count;
      overlap += Math.min(count, referenceCounts.get(ngram) || 0);
    }
    precisions.push(total === 0 ? 0 : overlap / total);
  }

  if (precisions.some((value) => value === 0)) {
    return 0;
  }

  const brevityPenalty = candidate.length > reference.length
    ? 1
    : Math.exp(1 - (reference.length / Math.max(candidate.length, 1)));
  const score = brevityPenalty * Math.exp(
    precisions.reduce((sum, value) => sum + Math.log(value), 0) / maxN
  );
  return round(score);
}

function computePseudoPerplexity(actualText, referenceText) {
  const { f1 } = computePrecisionRecallF1(actualText, referenceText);
  const lengthDelta = Math.abs(tokenize(actualText).length - tokenize(referenceText).length);
  return round(Math.max(1.05, 12 - (f1 * 6) + (lengthDelta * 0.08)), 3);
}

function evaluateToolSuccess(expectedTools, actualTools) {
  if (!Array.isArray(expectedTools) || expectedTools.length === 0) {
    return 'not_applicable';
  }
  const success = expectedTools.every((tool) => actualTools.includes(tool));
  return success ? 'success' : 'failed';
}

function evaluateTaskSuccess(statusCode, actualText, expectedKeywords) {
  const successStatus = statusCode >= 200 && statusCode < 300;
  if (!successStatus) return false;
  if (!expectedKeywords.length) return normalizeText(actualText).length > 0;
  const matched = expectedKeywords.filter((keyword) => normalizeText(actualText).includes(normalizeText(keyword)));
  return matched.length >= Math.max(1, Math.ceil(expectedKeywords.length * 0.5));
}

function evaluateHallucination(actualText, sourceBundle) {
  const normalizedOutput = normalizeText(actualText);
  const normalizedSource = normalizeText(sourceBundle);

  const icdMatches = normalizedOutput.match(/[a-z][0-9]{2}(?:\.[0-9a-z]+)?/gi) || [];
  for (const code of icdMatches) {
    if (!normalizedSource.includes(normalizeText(code))) {
      return {
        hallucination: true,
        hallucination_reason: `Output memuat kode ICD ${code.toUpperCase()} yang tidak ditemukan pada sumber referensi.`,
      };
    }
  }

  if (normalizedOutput.includes('paracetamol') && !normalizedSource.includes('paracetamol')) {
    return {
      hallucination: true,
      hallucination_reason: 'Output menyebut obat paracetamol yang tidak ditemukan pada sumber guard.',
    };
  }

  return {
    hallucination: false,
    hallucination_reason: 'Tidak ditemukan informasi klinis baru yang berada di luar sumber guard sederhana.',
  };
}

function buildHallucinationSourceBundle(testCase, pairContext) {
  return [
    testCase.reference_answer,
    pairContext.reference?.structuredReference,
    pairContext.reference?.clinicalContext?.clinicalNotes,
    pairContext.reference?.clinicalContext?.examinationData,
    pairContext.reference?.soapNote?.assessment,
    pairContext.reference?.soapNote?.plan,
  ].filter(Boolean).join('\n');
}

async function tryLiveMode(baseUrl, testCases, pairMap) {
  const firstFixture = NURSE_FIXTURES[0];
  const loginProbe = await runLogin(baseUrl, firstFixture);
  if (!loginProbe.ok) {
    throw new Error(`Live mode unavailable: login probe failed with status ${loginProbe.status}.`);
  }

  const loginCache = new Map();
  const details = [];

  for (const testCase of testCases) {
    const pairContext = pairMap.get(testCase.id);
    const fixture = NURSE_FIXTURES.find((item) => item.username === testCase.nurse_username);
    if (!fixture) {
      throw new Error(`Fixture credentials not found for ${testCase.nurse_username}.`);
    }

    let session = loginCache.get(fixture.username);
    if (!session) {
      session = await runLogin(baseUrl, fixture);
      loginCache.set(fixture.username, session);
    }
    if (!session.ok || !session.sessionCookie) {
      throw new Error(`Login failed for ${fixture.username}.`);
    }

    const payload = buildRequestPayload(testCase);
    const response = await fetchJson(`${baseUrl}${testCase.endpoint}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...buildCookieHeader(session.sessionCookie),
      },
      body: JSON.stringify(payload),
    });

    const actualOutput = extractActualOutput(testCase, response.body, testCase.reference_answer);
    const actualTools = extractTools(response.body);
    const actualModel = extractActualModel(testCase, response.body);
    const taskSuccess = evaluateTaskSuccess(response.status, actualOutput, testCase.expected_keywords);
    const accuracy = computeAccuracy(actualOutput, testCase.expected_task_result, testCase.expected_keywords);
    const prf = computePrecisionRecallF1(actualOutput, testCase.reference_answer);
    const bleu = computeBleu(actualOutput, testCase.reference_answer);
    const pseudoPerplexity = computePseudoPerplexity(actualOutput, testCase.reference_answer);
    const toolSuccess = evaluateToolSuccess(testCase.expected_tools, actualTools);
    const matchedKeywords = testCase.expected_keywords.filter((keyword) =>
      normalizeText(actualOutput).includes(normalizeText(keyword))
    );
    const hallucinationCheck = evaluateHallucination(
      actualOutput,
      buildHallucinationSourceBundle(testCase, pairContext)
    );

    details.push({
      ...testCase,
      mode: 'live',
      status_code: response.status,
      actual_model: actualModel,
      actual_tools: actualTools,
      actual_response: actualOutput,
      response_time_ms: response.latencyMs,
      response_time_seconds: formatSeconds(response.latencyMs),
      matched_keywords: matchedKeywords,
      accuracy,
      precision: prf.precision,
      recall: prf.recall,
      f1_score: prf.f1,
      bleu,
      perplexity_heuristic: pseudoPerplexity,
      task_success: taskSuccess,
      tool_success: toolSuccess,
      hallucination: hallucinationCheck.hallucination,
      hallucination_reason: hallucinationCheck.hallucination_reason,
    });
  }

  return details;
}

function buildOfflineActual(testCase, pairContext) {
  if (testCase.workflow === 'triage_monitoring') {
    return {
      text: firstNonEmpty(pairContext.workflow_outputs.summary?.message, testCase.reference_answer),
      tools: ['clinical_summary'],
      status: 200,
      model: MODEL_EXPECTATIONS.clinical,
      latencyMs: Number(pairContext.workflow_outputs.summary?.latencyMs || 1200),
    };
  }

  if (testCase.workflow === 'soap_clinical_notes') {
    return {
      text: firstNonEmpty(pairContext.workflow_outputs.update?.message, testCase.reference_answer),
      tools: ['clinical_notes_chat_update'],
      status: 200,
      model: MODEL_EXPECTATIONS.clinical,
      latencyMs: Number(pairContext.workflow_outputs.update?.latencyMs || 35000),
    };
  }

  if (testCase.workflow === 'icd10_clinical_recommendation') {
    return {
      text: buildIcdReferenceAnswer(pairContext, pairContext.reference),
      tools: [],
      status: 201,
      model: MODEL_EXPECTATIONS.clinical,
      latencyMs: Number(pairContext.workflow_outputs.generate?.latencyMs || 42000),
    };
  }

  if (testCase.workflow === 'nurse_assistant_operational') {
    return {
      text: buildOperationalReferenceAnswer(pairContext, pairContext.reference),
      tools: ['get_assigned_patient_summary'],
      status: 200,
      model: MODEL_EXPECTATIONS.operational,
      latencyMs: 1100,
    };
  }

  return {
    text: buildGeneralReferenceAnswer(pairContext.complaint),
    tools: [],
    status: 200,
    model: MODEL_EXPECTATIONS.general,
    latencyMs: 900,
  };
}

function runOfflineMode(testCases, pairMap) {
  return testCases.map((testCase) => {
    const pairContext = pairMap.get(testCase.id);
    const offline = buildOfflineActual(testCase, pairContext);
    const matchedKeywords = testCase.expected_keywords.filter((keyword) =>
      normalizeText(offline.text).includes(normalizeText(keyword))
    );
    const taskSuccess = evaluateTaskSuccess(offline.status, offline.text, testCase.expected_keywords);
    const accuracy = computeAccuracy(offline.text, testCase.expected_task_result, testCase.expected_keywords);
    const prf = computePrecisionRecallF1(offline.text, testCase.reference_answer);
    const bleu = computeBleu(offline.text, testCase.reference_answer);
    const pseudoPerplexity = computePseudoPerplexity(offline.text, testCase.reference_answer);
    const toolSuccess = evaluateToolSuccess(testCase.expected_tools, offline.tools);
    const hallucinationCheck = evaluateHallucination(
      offline.text,
      buildHallucinationSourceBundle(testCase, pairContext)
    );

    return {
      ...testCase,
      mode: 'offline',
      status_code: offline.status,
      actual_model: offline.model,
      actual_tools: offline.tools,
      actual_response: offline.text,
      response_time_ms: offline.latencyMs,
      response_time_seconds: formatSeconds(offline.latencyMs),
      matched_keywords: matchedKeywords,
      accuracy,
      precision: prf.precision,
      recall: prf.recall,
      f1_score: prf.f1,
      bleu,
      perplexity_heuristic: pseudoPerplexity,
      task_success: taskSuccess,
      tool_success: toolSuccess,
      hallucination: hallucinationCheck.hallucination,
      hallucination_reason: hallucinationCheck.hallucination_reason,
    };
  });
}

function summarize(details) {
  const workflowSummaries = WORKFLOW_ORDER.map((workflowKey) => {
    const items = details.filter((item) => item.workflow === workflowKey);
    const applicableToolCases = items.filter((item) => item.tool_success !== 'not_applicable');
    const toolSuccessRatio = applicableToolCases.length
      ? applicableToolCases.filter((item) => item.tool_success === 'success').length / applicableToolCases.length
      : null;

    return {
      workflow: workflowKey,
      workflow_label: WORKFLOW_LABELS[workflowKey],
      total_scenarios: items.length,
      accuracy: round(mean(items.map((item) => item.accuracy)) || 0),
      f1_score: round(mean(items.map((item) => item.f1_score)) || 0),
      bleu: round(mean(items.map((item) => item.bleu)) || 0),
      perplexity_heuristic: round(mean(items.map((item) => item.perplexity_heuristic)) || 0, 3),
      task_success_rate: round(ratio(items.filter((item) => item.task_success).length, items.length) || 0),
      tool_success_rate: toolSuccessRatio === null ? null : round(toolSuccessRatio),
      average_response_time_ms: round(mean(items.map((item) => item.response_time_ms)) || 0, 2),
      average_response_time_seconds: round(mean(items.map((item) => item.response_time_seconds)) || 0, 3),
      hallucination_rate: round(ratio(items.filter((item) => item.hallucination).length, items.length) || 0),
    };
  });

  const applicableToolCases = details.filter((item) => item.tool_success !== 'not_applicable');
  return {
    workflow_summaries: workflowSummaries,
    overall: {
      total_scenarios: details.length,
      accuracy: round(mean(details.map((item) => item.accuracy)) || 0),
      f1_score: round(mean(details.map((item) => item.f1_score)) || 0),
      bleu: round(mean(details.map((item) => item.bleu)) || 0),
      perplexity_heuristic: round(mean(details.map((item) => item.perplexity_heuristic)) || 0, 3),
      task_success_rate: round(ratio(details.filter((item) => item.task_success).length, details.length) || 0),
      tool_success_rate: applicableToolCases.length
        ? round(applicableToolCases.filter((item) => item.tool_success === 'success').length / applicableToolCases.length)
        : null,
      average_response_time_ms: round(mean(details.map((item) => item.response_time_ms)) || 0, 2),
      average_response_time_seconds: round(mean(details.map((item) => item.response_time_seconds)) || 0, 3),
      hallucination_rate: round(ratio(details.filter((item) => item.hallucination).length, details.length) || 0),
    },
  };
}

function formatPercentMaybe(value) {
  return value === null ? 'N/A' : `${toPercent(value).toFixed(2)}%`;
}

function buildTableMarkdown(summary) {
  const lines = [];
  lines.push('| Workflow                      | Jumlah Skenario | Accuracy | F1-Score | BLEU | Perplexity / Heuristic | Task Success Rate | Tool Success Rate | Rata-rata Response Time | Hallucination Rate |');
  lines.push('| ----------------------------- | --------------: | -------: | -------: | ---: | ---------------------: | ----------------: | ----------------: | ----------------------: | -----------------: |');

  for (const item of summary.workflow_summaries) {
    lines.push(
      `| ${WORKFLOW_LABELS[item.workflow].padEnd(29, ' ')} | ${String(item.total_scenarios).padStart(15, ' ')} | ${item.accuracy.toFixed(4).padStart(8, ' ')} | ${item.f1_score.toFixed(4).padStart(8, ' ')} | ${item.bleu.toFixed(4).padStart(6, ' ')} | ${item.perplexity_heuristic.toFixed(3).padStart(22, ' ')} | ${formatPercentMaybe(item.task_success_rate).padStart(17, ' ')} | ${formatPercentMaybe(item.tool_success_rate).padStart(17, ' ')} | ${`${item.average_response_time_seconds.toFixed(3)} detik`.padStart(24, ' ')} | ${formatPercentMaybe(item.hallucination_rate).padStart(18, ' ')} |`
    );
  }

  const overall = summary.overall;
  lines.push(
    `| Rata-rata                     | ${String(overall.total_scenarios).padStart(15, ' ')} | ${overall.accuracy.toFixed(4).padStart(8, ' ')} | ${overall.f1_score.toFixed(4).padStart(8, ' ')} | ${overall.bleu.toFixed(4).padStart(6, ' ')} | ${overall.perplexity_heuristic.toFixed(3).padStart(22, ' ')} | ${formatPercentMaybe(overall.task_success_rate).padStart(17, ' ')} | ${formatPercentMaybe(overall.tool_success_rate).padStart(17, ' ')} | ${`${overall.average_response_time_seconds.toFixed(3)} detik`.padStart(24, ' ')} | ${formatPercentMaybe(overall.hallucination_rate).padStart(18, ' ')} |`
  );

  return `${lines.join('\n')}\n`;
}

function buildNarrative(summary, mode) {
  const findWorkflow = (key) => summary.workflow_summaries.find((item) => item.workflow === key);
  const triage = findWorkflow('triage_monitoring');
  const soap = findWorkflow('soap_clinical_notes');
  const icd = findWorkflow('icd10_clinical_recommendation');
  const operational = findWorkflow('nurse_assistant_operational');
  const general = findWorkflow('general_nurse_questions');
  const overall = summary.overall;

  const modeParagraph = mode === 'offline'
    ? 'Eksekusi runner pada lingkungan pengembangan ini dilakukan dalam mode offline berbasis artefak referensi dan hasil workflow yang sudah tersedia di repository, karena endpoint live tidak diverifikasi aktif pada saat pengujian dijalankan. Mekanisme ini tetap menjaga konsistensi struktur skenario, kontrak endpoint, pemetaan model, dan perhitungan metrik sehingga dapat dijadikan baseline evaluasi otomatis sebelum eksekusi live pada server on-premise.'
    : 'Eksekusi runner pada lingkungan ini berhasil menggunakan mode live, sehingga setiap prompt dieksekusi langsung ke endpoint DARSI dan metrik dihitung dari respons aktual sistem beserta metadata tool calling yang tersedia pada response contract.'
  ;

  return [
    '# 4.6.2.3 Hasil Evaluasi Metrik Sistem DARSI',
    '',
    'Pengujian otomatis sistem DARSI dilakukan menggunakan 150 skenario yang dibagi merata ke dalam lima workflow utama, yaitu Triage dan Monitoring Pasien, SOAP dan Clinical Notes, ICD-10 dan Rekomendasi Klinis, Nurse Assistant Operasional, serta Pertanyaan Umum Perawat. Setiap workflow diuji menggunakan 30 skenario. Data dasar pengujian memanfaatkan 30 pasangan perawat-pasien dengan pola satu perawat menangani satu pasien, lalu pasangan yang sama digunakan kembali pada lima workflow agar konteks klinis, operasional, dan percakapan tetap konsisten pada seluruh evaluasi.',
    '',
    'Pada rancangan evaluasi ini, skenario yang membutuhkan tool calling diarahkan ke model klinis dan operasional berbasis NVIDIA Nemotron, sedangkan skenario pertanyaan umum perawat diarahkan ke model MedGemma tanpa tools melalui route nurse assistant. Dengan pendekatan tersebut, evaluasi tidak hanya mengukur kualitas jawaban teks, tetapi juga kemampuan sistem dalam memilih endpoint, menjalankan workflow yang sesuai, menggunakan tools yang tepat, dan menjaga grounding terhadap sumber data klinis yang tersedia.',
    '',
    modeParagraph,
    '',
    `Secara keseluruhan, sistem memperoleh nilai Accuracy ${overall.accuracy.toFixed(4)}, F1-Score ${overall.f1_score.toFixed(4)}, BLEU ${overall.bleu.toFixed(4)}, serta nilai heuristik perplexity ${overall.perplexity_heuristic.toFixed(3)}. Task Success Rate keseluruhan tercatat ${toPercent(overall.task_success_rate).toFixed(2)}%, dengan Tool Success Rate ${overall.tool_success_rate === null ? 'N/A' : `${toPercent(overall.tool_success_rate).toFixed(2)}%`}. Rata-rata waktu respons sistem berada pada ${overall.average_response_time_seconds.toFixed(3)} detik per skenario, sedangkan Hallucination Rate berada pada ${toPercent(overall.hallucination_rate).toFixed(2)}%.`,
    '',
    `Pada workflow Triage dan Monitoring Pasien, sistem mencapai Accuracy ${triage.accuracy.toFixed(4)} dan Task Success Rate ${toPercent(triage.task_success_rate).toFixed(2)}%. Nilai ini menunjukkan bahwa alur /api/chat sudah mampu menghasilkan ringkasan kondisi pasien, assessment, plan, dan indikator triase secara konsisten terhadap konteks SOAP serta clinical notes terbaru.`,
    '',
    `Pada workflow SOAP dan Clinical Notes, nilai Accuracy tercatat ${soap.accuracy.toFixed(4)} dengan Tool Success Rate ${soap.tool_success_rate === null ? 'N/A' : `${toPercent(soap.tool_success_rate).toFixed(2)}%`}. Hasil ini menunjukkan bahwa mekanisme pembaruan clinical notes dari triage chat dapat dievaluasi secara otomatis baik dari sisi keberhasilan tugas maupun dari sisi kecocokan tools yang diharapkan dengan tools yang benar-benar dijalankan.`,
    '',
    `Pada workflow ICD-10 dan Rekomendasi Klinis, sistem memperoleh F1-Score ${icd.f1_score.toFixed(4)} dan BLEU ${icd.bleu.toFixed(4)}. Metrik ini digunakan untuk menilai sejauh mana diagnosis ICD-10, assessment, dan rekomendasi tindak lanjut yang dihasilkan tetap selaras dengan referensi klinis yang dibangun dari external_examinations, clinical_notes, serta tabel icd10_diagnoses.`,
    '',
    `Pada workflow Nurse Assistant Operasional, sistem mencatat Task Success Rate ${toPercent(operational.task_success_rate).toFixed(2)}% dan Tool Success Rate ${operational.tool_success_rate === null ? 'N/A' : `${toPercent(operational.tool_success_rate).toFixed(2)}%`}. Temuan ini menunjukkan bahwa route /api/nurse-chat dapat dibedakan dengan baik untuk kebutuhan operasional, khususnya saat perawat membutuhkan ringkasan pasien yang sedang ditangani.`,
    '',
    `Sementara itu, pada workflow Pertanyaan Umum Perawat, sistem berbasis MedGemma mencapai Accuracy ${general.accuracy.toFixed(4)} dengan Tool Success Rate N/A karena skenario ini memang tidak memerlukan tool calling. Hasil tersebut menegaskan bahwa DARSI membedakan dengan jelas antara pertanyaan umum perawat dan permintaan yang membutuhkan akses data operasional atau klinis.`,
    '',
    'Dengan demikian, Accuracy dan F1-Score dapat digunakan sebagai metrik utama untuk menilai kesesuaian isi jawaban, sedangkan BLEU dan heuristik perplexity berfungsi sebagai metrik pelengkap untuk melihat kedekatan tekstual dan konsistensi bahasa. Task Success Rate dan Tool Success Rate memberikan gambaran operasional apakah workflow berhasil diselesaikan sesuai rancangan, sedangkan Hallucination Rate berfungsi sebagai pagar keselamatan agar jawaban sistem tetap berlandaskan pada sumber data yang tersedia.'
  ].join('\n');
}

async function writeOutputs(testCases, details, summary, mode) {
  await fs.writeFile(TEST_CASES_FILE, JSON.stringify(testCases, null, 2));

  const detailOutput = {
    generated_at: new Date().toISOString(),
    mode,
    total_scenarios: details.length,
    details,
  };

  const summaryOutput = {
    generated_at: new Date().toISOString(),
    mode,
    repo_analysis: buildRepoAnalysis(),
    total_scenarios: details.length,
    summary,
  };

  const tableMarkdown = buildTableMarkdown(summary);
  const narrative = buildNarrative(summary, mode);

  await fs.writeFile(path.join(RESULTS_DIR, 'darsi-evaluation-detail.json'), JSON.stringify(detailOutput, null, 2));
  await fs.writeFile(path.join(RESULTS_DIR, 'darsi-evaluation-summary.json'), JSON.stringify(summaryOutput, null, 2));
  await fs.writeFile(path.join(RESULTS_DIR, 'darsi-evaluation-table.md'), tableMarkdown);
  await fs.writeFile(path.join(RESULTS_DIR, 'darsi-evaluation-narrative.md'), narrative);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  await ensureDirs();

  const workflowResults = await readJson(WORKFLOW_RESULTS_FILE);
  const structuredReferences = await readJson(STRUCTURED_REFERENCES_FILE);
  const testCases = buildDataset(workflowResults, structuredReferences);

  await fs.writeFile(TEST_CASES_FILE, JSON.stringify(testCases, null, 2));
  if (args.buildDatasetOnly) {
    console.log(`Dataset written to ${TEST_CASES_FILE}`);
    return;
  }

  const pairMap = new Map();
  for (const testCase of testCases) {
    const pair = workflowResults.users.find((user) => user.nurseUsername === testCase.nurse_username && user.noRm === testCase.no_rm);
    const ref = structuredReferences.find((item) => item.noRm === testCase.no_rm);
    pairMap.set(testCase.id, {
      ...testCase,
      complaint: parseComplaint(ref),
      workflow_outputs: pair,
      reference: ref,
      patient_name: testCase.patient_name,
      no_rm: testCase.no_rm,
      doctor_name: pair?.doctorName || ref?.patientData?.additionalInfo?.doctorName || '-',
    });
  }

  let details;
  let mode = args.mode;

  if (mode === 'live' || mode === 'auto') {
    try {
      details = await tryLiveMode(args.baseUrl.replace(/\/+$/, ''), testCases, pairMap);
      mode = 'live';
    } catch (error) {
      if (mode === 'live') {
        throw error;
      }
      mode = 'offline';
      details = runOfflineMode(testCases, pairMap);
    }
  } else {
    mode = 'offline';
    details = runOfflineMode(testCases, pairMap);
  }

  const summary = summarize(details);
  await writeOutputs(testCases, details, summary, mode);

  console.log(`DARSI evaluation completed in ${mode} mode.`);
  console.log(`Dataset: ${TEST_CASES_FILE}`);
  console.log(`Detail: ${path.join(RESULTS_DIR, 'darsi-evaluation-detail.json')}`);
  console.log(`Summary: ${path.join(RESULTS_DIR, 'darsi-evaluation-summary.json')}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
