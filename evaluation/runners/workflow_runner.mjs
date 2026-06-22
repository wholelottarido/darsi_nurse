import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { Client } from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const RESULTS_DIR = path.join(PROJECT_ROOT, 'evaluation', 'results');
const DOTENV_PATH = path.join(PROJECT_ROOT, '.env');

const DEFAULT_BASE_URL = 'http://127.0.0.1:3019';
const DEFAULT_LIMIT = 30;
const DEFAULT_CONCURRENCY = 30;

const DEFAULT_SCENARIOS = ['summary', 'objective', 'update', 'generate'];

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

const SCENARIO_MESSAGES = {
  summary: {
    name: 'clinical_summary',
    label: 'Clinical summary',
    request: (patient) => `Ringkaskan kondisi pasien ini berdasarkan SOAP dan clinical summary. Fokus pada kondisi pasien, assessment, plan, dan tindakan.`,
  },
  objective: {
    name: 'objective_summary',
    label: 'Objective summary',
    request: (patient) => `Ringkasan objective pasien.`,
  },
  update: {
    name: 'update_subjective',
    label: 'Update kondisi pasien',
    request: (patient) => `update kondisi pasien: demam berkurang, masih lemas, nafsu makan mulai membaik.`,
  },
  generate: {
    name: 'generate_clinical_notes',
    label: 'Generate clinical notes',
    request: (patient) => null,
  },
};

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.APP_BASE_URL || DEFAULT_BASE_URL,
    limit: DEFAULT_LIMIT,
    concurrency: DEFAULT_CONCURRENCY,
    scenarios: [...DEFAULT_SCENARIOS],
    dryRun: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const value = argv[i];
    if (value === '--dry-run') {
      args.dryRun = true;
    } else if (value.startsWith('--base-url=')) {
      args.baseUrl = value.slice('--base-url='.length);
    } else if (value.startsWith('--limit=')) {
      args.limit = Number(value.slice('--limit='.length));
    } else if (value.startsWith('--concurrency=')) {
      args.concurrency = Number(value.slice('--concurrency='.length));
    } else if (value.startsWith('--scenarios=')) {
      args.scenarios = value
        .slice('--scenarios='.length)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return args;
}

async function loadDotEnvIfNeeded() {
  const neededKeys = ['APP_BASE_URL', 'HOSPITAL_CS_DATABASE_URL', 'DATABASE_URL'];
  const missing = neededKeys.filter((key) => !process.env[key]);
  if (missing.length === 0) {
    return;
  }

  try {
    const raw = await awaitableReadFile(DOTENV_PATH);
    if (!raw) {
      return;
    }

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

function awaitableReadFile(filePath) {
  return fs.readFile(filePath, 'utf8').catch(() => null);
}

function getDatabaseUrl() {
  return process.env.HOSPITAL_CS_DATABASE_URL || process.env.DATABASE_URL;
}

function normalizeBaseUrl(baseUrl) {
  return baseUrl.replace(/\/+$/, '');
}

function formatDuration(ms) {
  if (!Number.isFinite(ms)) {
    return '-';
  }

  if (ms < 1000) {
    return `${Math.round(ms)} ms`;
  }

  return `${(ms / 1000).toFixed(2)} s`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function safeText(value, fallback = '-') {
  const text = value === null || value === undefined ? '' : String(value);
  return text.trim() || fallback;
}

function percentile(values, p) {
  if (!values.length) {
    return 0;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function mean(values) {
  if (!values.length) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
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

function extractCookieValue(setCookieHeaders, cookieName) {
  for (const header of setCookieHeaders) {
    const firstPart = header.split(';')[0] || '';
    const index = firstPart.indexOf('=');
    if (index === -1) {
      continue;
    }

    const name = firstPart.slice(0, index).trim();
    if (name === cookieName) {
      return firstPart.slice(index + 1);
    }
  }

  return null;
}

function getHeadersFromCookies(cookiePairs) {
  const normalized = cookiePairs
    .filter(Boolean)
    .map((cookie) => String(cookie).includes('=') ? String(cookie) : `darsi_nurse_session=${String(cookie)}`);

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
  const headersWithGetSetCookie = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie()
    : splitSetCookieHeader(response.headers.get('set-cookie'));

  return {
    ok: response.ok,
    status: response.status,
    headers: response.headers,
    setCookies: headersWithGetSetCookie,
    body: parsed ?? text,
    text,
    latencyMs: Date.now() - startedAt,
  };
}

async function withConcurrency(items, concurrency, worker) {
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
  await Promise.all(workers);
  return results;
}

async function ensureResultsDir() {
  await fs.mkdir(RESULTS_DIR, { recursive: true });
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

async function loadTestDataset(client, limit) {
  const result = await client.query(
    `SELECT
       n.id AS nurse_id,
       n.username AS nurse_username,
       n.full_name AS nurse_full_name,
       p.id AS patient_id,
       p.no_rm,
       p.full_name AS patient_name,
       p.insurance_type,
       r.id AS registration_id,
       r.booking_code,
       r.doctor_id,
       d.username AS doctor_username,
       d.full_name AS doctor_name,
       COALESCE(ee.id, NULL) AS exam_id
     FROM indirect_staff_nurses n
     JOIN registrations r ON r.nurse_id = n.id
     JOIN patients p ON p.id = r.patient_id
     LEFT JOIN indirect_staff_doctors d ON d.id = r.doctor_id
     LEFT JOIN LATERAL (
       SELECT id
       FROM external_examinations ee
       WHERE ee.registration_id = r.id
       ORDER BY created_at DESC, id DESC
       LIMIT 1
     ) ee ON true
     WHERE p.no_rm LIKE 'RMDUMMY26%'
     ORDER BY n.id ASC
     LIMIT $1`,
    [limit]
  );

  return result.rows.map((row) => ({
    nurseId: Number(row.nurse_id),
    nurseUsername: String(row.nurse_username),
    nurseFullName: String(row.nurse_full_name),
    patientId: Number(row.patient_id),
    noRm: String(row.no_rm),
    patientName: String(row.patient_name),
    insuranceType: String(row.insurance_type || 'manual'),
    registrationId: Number(row.registration_id),
    bookingCode: String(row.booking_code),
    doctorId: Number(row.doctor_id),
    doctorUsername: String(row.doctor_username || ''),
    doctorName: String(row.doctor_name || '-'),
    examId: row.exam_id ? Number(row.exam_id) : null,
  }));
}

async function runLogin(baseUrl, user) {
  const response = await fetchJson(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      username: user.username,
      password: user.password,
    }),
  });

  const rawSetCookie = typeof response.headers.getSetCookie === 'function'
    ? response.headers.getSetCookie().join(', ')
    : (response.headers.get('set-cookie') || '');
  const sessionCookieMatch = rawSetCookie.match(/(?:^|,\s*)darsi_nurse_session=([^;]+)/);
  const sessionCookie = sessionCookieMatch ? sessionCookieMatch[1] : null;
  const body = response.body && typeof response.body === 'object' ? response.body : {};

  return {
    ok: response.ok && Boolean(sessionCookie),
    status: response.status,
    latencyMs: response.latencyMs,
    sessionCookie,
    body,
  };
}

async function runChatScenario(baseUrl, sessionCookie, payload) {
  return fetchJson(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...getHeadersFromCookies([sessionCookie]),
    },
    body: JSON.stringify(payload),
  });
}

async function runClinicalNotesScenario(baseUrl, sessionCookie, payload) {
  return fetchJson(`${baseUrl}/api/clinical-notes/generate`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...getHeadersFromCookies([sessionCookie]),
    },
    body: JSON.stringify(payload),
  });
}

function buildScenarioPayloads(datasetRow) {
  return {
    summary: {
      message: 'Ringkaskan kondisi pasien ini berdasarkan SOAP dan clinical summary. Fokus pada kondisi pasien, assessment, plan, dan tindakan.',
      patientId: String(datasetRow.patientId),
      registrationId: datasetRow.registrationId,
    },
    objective: {
      message: 'Ringkasan objective pasien.',
      patientId: String(datasetRow.patientId),
      registrationId: datasetRow.registrationId,
    },
    update: {
      message: 'update kondisi pasien: demam berkurang, masih lemas, nafsu makan mulai membaik.',
      patientId: String(datasetRow.patientId),
      registrationId: datasetRow.registrationId,
    },
    generate: {
      patientId: datasetRow.patientId,
      triageVisitId: null,
    },
  };
}

function summarizeResponse(response) {
  if (!response) {
    return { ok: false, status: 0, latencyMs: 0, toolsUsed: [], message: null, error: 'No response' };
  }

  const body = response.body && typeof response.body === 'object' ? response.body : {};
  const toolsUsed = Array.isArray(body.toolsUsed) ? body.toolsUsed : [];
  const message = typeof body.message === 'string' ? body.message : null;
  const error = typeof body.error === 'string' ? body.error : null;

  return {
    ok: response.ok,
    status: response.status,
    latencyMs: response.latencyMs,
    toolsUsed,
    message,
    error,
  };
}

function buildSvgBarChart({ title, subtitle, labels, values, unit = 'ms', width = 1100, height = 520, maxValue = null, color = '#0f766e' }) {
  const leftPad = 90;
  const rightPad = 30;
  const topPad = 70;
  const bottomPad = 110;
  const chartWidth = width - leftPad - rightPad;
  const chartHeight = height - topPad - bottomPad;
  const bars = labels.length;
  const gap = 18;
  const barWidth = bars > 0 ? Math.max(16, Math.floor((chartWidth - gap * (bars - 1)) / bars)) : 0;
  const max = maxValue ?? Math.max(...values, 1);
  const gridLines = 5;

  const grid = Array.from({ length: gridLines + 1 }, (_, index) => {
    const y = topPad + (chartHeight / gridLines) * index;
    const value = max - (max / gridLines) * index;
    return `<line x1="${leftPad}" y1="${y.toFixed(2)}" x2="${width - rightPad}" y2="${y.toFixed(2)}" stroke="#dbe4ea" stroke-width="1" />` +
      `<text x="${leftPad - 10}" y="${(y + 4).toFixed(2)}" text-anchor="end" font-family="Inter, Arial, sans-serif" font-size="12" fill="#64748b">${Math.round(value)}${unit ? ` ${unit}` : ''}</text>`;
  }).join('');

  const barsMarkup = labels.map((label, index) => {
    const value = values[index];
    const normalizedHeight = max === 0 ? 0 : (value / max) * chartHeight;
    const x = leftPad + index * (barWidth + gap);
    const y = topPad + (chartHeight - normalizedHeight);
    const barHeight = Math.max(0, normalizedHeight);
    const labelY = height - 56;
    const valueY = Math.max(topPad + 20, y - 8);
    return `
      <rect x="${x}" y="${y.toFixed(2)}" width="${barWidth}" height="${barHeight.toFixed(2)}" rx="10" fill="${color}" />
      <text x="${(x + barWidth / 2).toFixed(2)}" y="${valueY.toFixed(2)}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="700" fill="#0f172a">${formatChartValue(value, unit)}</text>
      <text x="${(x + barWidth / 2).toFixed(2)}" y="${labelY}" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="13" fill="#334155">
        ${escapeXml(label)}
      </text>
    `;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(title)}</title>
  <desc id="desc">${escapeXml(subtitle)}</desc>
  <rect width="100%" height="100%" fill="#ffffff" />
  <text x="${leftPad}" y="32" font-family="Inter, Arial, sans-serif" font-size="24" font-weight="800" fill="#0f172a">${escapeXml(title)}</text>
  <text x="${leftPad}" y="54" font-family="Inter, Arial, sans-serif" font-size="13" fill="#64748b">${escapeXml(subtitle)}</text>
  ${grid}
  ${barsMarkup}
</svg>`;
}

function formatChartValue(value, unit) {
  if (unit === '%') {
    return `${value.toFixed(1)}%`;
  }

  if (unit === 'ms') {
    return `${Math.round(value)} ms`;
  }

  return String(value);
}

function buildMarkdownReport({ startedAt, finishedAt, dataset, stageResults, auditSummary, runInfo }) {
  const totalRows = dataset.length;
  const stageOrder = ['summary', 'objective', 'update', 'generate'];
  const stageMeta = {
    summary: 'Clinical summary',
    objective: 'Objective summary',
    update: 'Update kondisi pasien',
    generate: 'Generate clinical notes',
  };

  const stageRows = stageOrder.map((stageKey) => {
    const rows = stageResults[stageKey] || [];
    const latencyValues = rows.map((item) => item.latencyMs || 0);
    const successCount = rows.filter((item) => item.ok).length;
    const tools = new Set(rows.flatMap((item) => item.toolsUsed || []));
    return {
      key: stageKey,
      label: stageMeta[stageKey],
      count: rows.length,
      successRate: rows.length ? (successCount / rows.length) * 100 : 0,
      avgLatency: mean(latencyValues),
      p95Latency: percentile(latencyValues, 95),
      tools: [...tools].join(', ') || '-',
    };
  });

  const perNurseRows = dataset.map((row, index) => {
    const login = runInfo.logins[index];
    const summary = runInfo.summary[index];
    const objective = runInfo.objective[index];
    const update = runInfo.update[index];
    const generate = runInfo.generate[index];
    return {
      nurse: row.nurseUsername,
      patient: row.patientName,
      login: login.ok ? 'OK' : 'FAIL',
      summary: summary.ok ? 'OK' : 'FAIL',
      objective: objective.ok ? 'OK' : 'FAIL',
      update: update.ok ? 'OK' : 'FAIL',
      generate: generate.ok ? 'OK' : 'FAIL',
      totalLatency: Math.round((login.latencyMs || 0) + (summary.latencyMs || 0) + (objective.latencyMs || 0) + (update.latencyMs || 0) + (generate.latencyMs || 0)),
    };
  });

  const md = [];
  md.push('# Workflow Test Report');
  md.push('');
  md.push(`- Started: ${startedAt.toISOString()}`);
  md.push(`- Finished: ${finishedAt.toISOString()}`);
  md.push(`- Base URL: ${runInfo.baseUrl}`);
  md.push(`- Nurses tested: ${totalRows}`);
  md.push(`- Scenarios: ${stageOrder.map((key) => stageMeta[key]).join(', ')}`);
  md.push('');
  md.push('## Summary');
  md.push('');
  md.push('| Stage | Count | Success Rate | Avg Latency | P95 Latency | Tools Observed |');
  md.push('|---|---:|---:|---:|---:|---|');
  for (const row of stageRows) {
    md.push(`| ${row.label} | ${row.count} | ${row.successRate.toFixed(1)}% | ${Math.round(row.avgLatency)} ms | ${Math.round(row.p95Latency)} ms | ${escapePipe(row.tools)} |`);
  }
  md.push('');
  md.push('## Audit');
  md.push('');
  md.push('| Log Type | Count |');
  md.push('|---|---:|');
  md.push(`| agent_interaction_logs | ${auditSummary.interactionCount} |`);
  md.push(`| agent_data_source_logs | ${auditSummary.dataSourceCount} |`);
  md.push(`| agent_performance_logs | ${auditSummary.performanceCount} |`);
  md.push('');
  md.push('## Per Nurse');
  md.push('');
  md.push('| Nurse | Patient | Login | Summary | Objective | Update | Generate | Total Latency |');
  md.push('|---|---|---|---|---|---|---|---:|');
  for (const row of perNurseRows) {
    md.push(`| ${escapePipe(row.nurse)} | ${escapePipe(row.patient)} | ${row.login} | ${row.summary} | ${row.objective} | ${row.update} | ${row.generate} | ${row.totalLatency} ms |`);
  }
  md.push('');
  md.push('## Charts');
  md.push('');
  md.push('![Average latency](./workflow_latency.svg)');
  md.push('');
  md.push('![Success rate](./workflow_success_rate.svg)');
  md.push('');

  return md.join('\n');
}

function escapePipe(value) {
  return safeText(value).replace(/\|/g, '\\|');
}

async function queryAuditSummary(client, startedAtIso) {
  const interactionCount = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM agent_interaction_logs
     WHERE created_at >= $1
       AND route_name IN ('/api/chat', '/api/clinical-notes/generate')`,
    [startedAtIso]
  );
  const dataSourceCount = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM agent_data_source_logs
     WHERE created_at >= $1`,
    [startedAtIso]
  );
  const performanceCount = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM agent_performance_logs
     WHERE created_at >= $1`,
    [startedAtIso]
  );

  return {
    interactionCount: interactionCount.rows[0].count,
    dataSourceCount: dataSourceCount.rows[0].count,
    performanceCount: performanceCount.rows[0].count,
  };
}

async function main() {
  await loadDotEnvIfNeeded();

  const args = parseArgs(process.argv.slice(2));
  const baseUrl = normalizeBaseUrl(args.baseUrl);
  const startedAt = new Date();

  await ensureResultsDir();

  const client = await connectDatabase();

  try {
    const dataset = await loadTestDataset(client, args.limit);
    if (dataset.length === 0) {
      throw new Error('Tidak ada data test yang cocok. Pastikan 30 nurse, registration, patient, dan external_examinations sudah terpasang.');
    }

    if (dataset.length < args.limit) {
      console.warn(`⚠️ Dataset hanya berisi ${dataset.length} row, lebih kecil dari limit ${args.limit}.`);
    }

    const users = dataset.map((row) => {
      const fixture = NURSE_FIXTURES.find((item) => item.username === row.nurseUsername);
      if (!fixture) {
        throw new Error(`Password fixture untuk nurse ${row.nurseUsername} tidak ditemukan.`);
      }

      return { ...row, username: row.nurseUsername, password: fixture.password };
    });

    if (args.dryRun) {
      console.log(`Dry run only. Base URL: ${baseUrl}`);
      console.table(users.map((row) => ({
        nurse: row.nurseUsername,
        patient: row.patientName,
        registration: row.registrationId,
        doctor: row.doctorName,
      })));
      return;
    }

    console.log(`🚀 Workflow test dimulai untuk ${users.length} perawat pada ${baseUrl}`);
    console.log('Stage 1: login paralel');

    const logins = await withConcurrency(users, args.concurrency, async (user) => {
      const result = await runLogin(baseUrl, user);
      return {
        ok: result.ok,
        status: result.status,
        latencyMs: result.latencyMs,
        sessionCookie: result.sessionCookie,
        body: result.body,
      };
    });

    const loginFailures = logins.filter((item) => !item.ok);
    if (loginFailures.length > 0) {
      console.warn(`⚠️ Login gagal pada ${loginFailures.length} akun.`);
    }

    const stageResults = {
      summary: [],
      objective: [],
      update: [],
      generate: [],
    };

    const summaryPayloads = users.map((user) => buildScenarioPayloads(user).summary);
    const objectivePayloads = users.map((user) => buildScenarioPayloads(user).objective);
    const updatePayloads = users.map((user) => buildScenarioPayloads(user).update);
    const generatePayloads = users.map((user) => buildScenarioPayloads(user).generate);

    console.log('Stage 2: clinical summary paralel');
    stageResults.summary = await withConcurrency(users, args.concurrency, async (user, index) => {
      const login = logins[index];
      if (!login.ok || !login.sessionCookie) {
        return { ok: false, status: 401, latencyMs: 0, toolsUsed: [], message: null, error: 'login_failed' };
      }

      const response = await runChatScenario(baseUrl, login.sessionCookie, summaryPayloads[index]);
      return summarizeResponse(response);
    });

    if (args.scenarios.includes('objective')) {
      console.log('Stage 3: objective summary paralel');
      stageResults.objective = await withConcurrency(users, args.concurrency, async (user, index) => {
        const login = logins[index];
        if (!login.ok || !login.sessionCookie) {
          return { ok: false, status: 401, latencyMs: 0, toolsUsed: [], message: null, error: 'login_failed' };
        }

        const response = await runChatScenario(baseUrl, login.sessionCookie, objectivePayloads[index]);
        return summarizeResponse(response);
      });
    } else {
      stageResults.objective = users.map(() => ({ ok: true, status: 204, latencyMs: 0, toolsUsed: [], message: null, error: null }));
    }

    if (args.scenarios.includes('update')) {
      console.log('Stage 4: update kondisi pasien paralel');
      stageResults.update = await withConcurrency(users, args.concurrency, async (user, index) => {
        const login = logins[index];
        if (!login.ok || !login.sessionCookie) {
          return { ok: false, status: 401, latencyMs: 0, toolsUsed: [], message: null, error: 'login_failed' };
        }

        const response = await runChatScenario(baseUrl, login.sessionCookie, updatePayloads[index]);
        return summarizeResponse(response);
      });
    } else {
      stageResults.update = users.map(() => ({ ok: true, status: 204, latencyMs: 0, toolsUsed: [], message: null, error: null }));
    }

    if (args.scenarios.includes('generate')) {
      console.log('Stage 5: clinical notes generation paralel');
      stageResults.generate = await withConcurrency(users, args.concurrency, async (user, index) => {
        const login = logins[index];
        if (!login.ok || !login.sessionCookie) {
          return { ok: false, status: 401, latencyMs: 0, toolsUsed: [], message: null, error: 'login_failed' };
        }

        const response = await runClinicalNotesScenario(baseUrl, login.sessionCookie, generatePayloads[index]);
        return summarizeResponse(response);
      });
    } else {
      stageResults.generate = users.map(() => ({ ok: true, status: 204, latencyMs: 0, toolsUsed: [], message: null, error: null }));
    }

    const finishedAt = new Date();
    const auditSummary = await queryAuditSummary(client, startedAt.toISOString());

    const summaryLatencies = stageResults.summary.map((item) => item.latencyMs || 0);
    const objectiveLatencies = stageResults.objective.map((item) => item.latencyMs || 0);
    const updateLatencies = stageResults.update.map((item) => item.latencyMs || 0);
    const generateLatencies = stageResults.generate.map((item) => item.latencyMs || 0);

    const stageStats = [
      {
        key: 'summary',
        label: 'Clinical summary',
        avgLatency: mean(summaryLatencies),
        successRate: stageResults.summary.filter((item) => item.ok).length / stageResults.summary.length * 100,
      },
      {
        key: 'objective',
        label: 'Objective summary',
        avgLatency: mean(objectiveLatencies),
        successRate: stageResults.objective.filter((item) => item.ok).length / stageResults.objective.length * 100,
      },
      {
        key: 'update',
        label: 'Update kondisi pasien',
        avgLatency: mean(updateLatencies),
        successRate: stageResults.update.filter((item) => item.ok).length / stageResults.update.length * 100,
      },
      {
        key: 'generate',
        label: 'Generate clinical notes',
        avgLatency: mean(generateLatencies),
        successRate: stageResults.generate.filter((item) => item.ok).length / stageResults.generate.length * 100,
      },
    ];

    const latencySvg = buildSvgBarChart({
      title: 'Average Latency per Stage',
      subtitle: 'Waktu rata-rata respons untuk tiap workflow pada 30 perawat paralel.',
      labels: stageStats.map((item) => item.label),
      values: stageStats.map((item) => item.avgLatency),
      unit: 'ms',
      color: '#0f766e',
    });

    const successSvg = buildSvgBarChart({
      title: 'Success Rate per Stage',
      subtitle: 'Persentase request sukses untuk tiap workflow pada 30 perawat paralel.',
      labels: stageStats.map((item) => item.label),
      values: stageStats.map((item) => item.successRate),
      unit: '%',
      color: '#2563eb',
      maxValue: 100,
    });

    const runInfo = {
      baseUrl,
      logins,
      summary: stageResults.summary,
      objective: stageResults.objective,
      update: stageResults.update,
      generate: stageResults.generate,
    };

    const report = buildMarkdownReport({
      startedAt,
      finishedAt,
      dataset: users,
      stageResults,
      auditSummary,
      runInfo,
    });

    const resultsJson = {
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      baseUrl,
      totalNurses: users.length,
      auditSummary,
      stageStats,
      users: users.map((user, index) => ({
        nurseUsername: user.nurseUsername,
        nurseFullName: user.nurseFullName,
        patientName: user.patientName,
        noRm: user.noRm,
        registrationId: user.registrationId,
        doctorName: user.doctorName,
        login: logins[index],
        summary: stageResults.summary[index],
        objective: stageResults.objective[index],
        update: stageResults.update[index],
        generate: stageResults.generate[index],
      })),
    };

    await fs.writeFile(path.join(RESULTS_DIR, 'workflow_report.md'), report, 'utf8');
    await fs.writeFile(path.join(RESULTS_DIR, 'workflow_results.json'), JSON.stringify(resultsJson, null, 2), 'utf8');
    await fs.writeFile(path.join(RESULTS_DIR, 'workflow_latency.svg'), latencySvg, 'utf8');
    await fs.writeFile(path.join(RESULTS_DIR, 'workflow_success_rate.svg'), successSvg, 'utf8');

    console.log('✅ Workflow report tersimpan di evaluation/results/');
    console.table(stageStats.map((row) => ({
      Stage: row.label,
      'Success Rate': `${row.successRate.toFixed(1)}%`,
      'Avg Latency': `${Math.round(row.avgLatency)} ms`,
    })));
    console.log(`✅ Audit logs: interaction=${auditSummary.interactionCount}, data_source=${auditSummary.dataSourceCount}, performance=${auditSummary.performanceCount}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('Workflow runner failed:', error);
  process.exitCode = 1;
});
