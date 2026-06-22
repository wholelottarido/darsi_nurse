import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import sharp from 'sharp';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const RESULTS_DIR = path.join(PROJECT_ROOT, 'evaluation', 'results');
const DEFAULT_INPUT_FILE = path.join(RESULTS_DIR, 'workflow_results.json');
const ROOT_OUTPUTS = {
  json: path.join(RESULTS_DIR, 'phase3_tool_calling_results.json'),
  csv: path.join(RESULTS_DIR, 'phase3_tool_calling_summary.csv'),
  md: path.join(RESULTS_DIR, 'phase3_tool_calling_summary.md'),
  tex: path.join(RESULTS_DIR, 'phase3_tool_calling_table_latex.tex'),
  successPng: path.join(RESULTS_DIR, 'phase3_tool_success_rate.png'),
  errorPng: path.join(RESULTS_DIR, 'phase3_tool_error_rate.png'),
  latencyPng: path.join(RESULTS_DIR, 'phase3_tool_latency.png'),
  html: path.join(RESULTS_DIR, 'phase3_tool_calling_dashboard.html'),
};

const ORGANIZED_DIRS = {
  phase2: path.join(RESULTS_DIR, 'phase2_workflow'),
  phase3: path.join(RESULTS_DIR, 'phase3_tool_calling'),
};

const STAGES = [
  {
    key: 'summary',
    label: 'Clinical summary',
    expectedTool: 'clinical_summary',
    requiresTool: true,
    toolMode: 'tool-calling',
    routeLabel: '/api/chat',
  },
  {
    key: 'objective',
    label: 'Objective summary',
    expectedTool: 'external_examinations_objective_summary',
    requiresTool: true,
    toolMode: 'tool-calling',
    routeLabel: '/api/chat',
  },
  {
    key: 'update',
    label: 'Update kondisi pasien',
    expectedTool: 'clinical_notes_chat_update',
    requiresTool: true,
    toolMode: 'tool-calling',
    routeLabel: '/api/chat',
  },
  {
    key: 'generate',
    label: 'Generate clinical notes',
    expectedTool: 'Direct endpoint / N/A',
    requiresTool: false,
    toolMode: 'direct endpoint / N/A',
    routeLabel: '/api/clinical-notes/generate',
  },
];

function parseArgs(argv) {
  const args = {
    inputFile: DEFAULT_INPUT_FILE,
    outputDir: RESULTS_DIR,
  };

  for (const value of argv) {
    if (value.startsWith('--input=')) {
      args.inputFile = path.resolve(PROJECT_ROOT, value.slice('--input='.length));
    } else if (value.startsWith('--output-dir=')) {
      args.outputDir = path.resolve(PROJECT_ROOT, value.slice('--output-dir='.length));
    }
  }

  return args;
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeCsv(value) {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
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

function round1(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10) / 10;
}

function round2(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

function formatPercent(value, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'N/A';
  }

  return `${value.toFixed(digits)}%`;
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

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function weightedMean(values, weights) {
  let numerator = 0;
  let denominator = 0;

  values.forEach((value, index) => {
    const weight = Number(weights[index]);
    if (Number.isFinite(value) && Number.isFinite(weight) && weight > 0) {
      numerator += value * weight;
      denominator += weight;
    }
  });

  if (denominator === 0) {
    return null;
  }

  return numerator / denominator;
}

function percent(numerator, denominator) {
  if (!denominator) {
    return null;
  }

  return (numerator / denominator) * 100;
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeToolsUsed(value) {
  return ensureArray(value)
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function getStageResult(user, stageKey) {
  return user?.[stageKey] ?? {};
}

function evaluateStage(user, stage) {
  const stageResult = getStageResult(user, stage.key);
  const toolsUsed = normalizeToolsUsed(stageResult.toolsUsed);
  const ok = Boolean(stageResult.ok);
  const status = stageResult.status ?? null;
  const latencyMs = toNumber(stageResult.latencyMs);
  const taskSuccess = ok && (status === 200 || status === 201);

  if (!stage.requiresTool) {
    return {
      key: stage.key,
      label: stage.label,
      routeLabel: stage.routeLabel,
      expectedTool: stage.expectedTool,
      toolMode: stage.toolMode,
      toolsUsed,
      ok,
      status,
      latencyMs,
      taskSuccess,
      toolCallingApplicable: false,
      toolMatch: null,
      missingTool: false,
      wrongTool: false,
    };
  }

  const toolMatch = toolsUsed.includes(stage.expectedTool);
  const missingTool = toolsUsed.length === 0;
  const wrongTool = !toolMatch && toolsUsed.length > 0;

  return {
    key: stage.key,
    label: stage.label,
    routeLabel: stage.routeLabel,
    expectedTool: stage.expectedTool,
    toolMode: stage.toolMode,
    toolsUsed,
    ok,
    status,
    latencyMs,
    taskSuccess,
    toolCallingApplicable: true,
    toolMatch,
    missingTool,
    wrongTool,
  };
}

function aggregateStageResults(results) {
  const totalCases = results.length;
  const toolRequiredResults = results.filter((result) => result.toolCallingApplicable);
  const directEndpointResults = results.filter((result) => !result.toolCallingApplicable);

  const correctToolCalls = toolRequiredResults.filter((result) => result.toolMatch).length;
  const missingToolCalls = toolRequiredResults.filter((result) => result.missingTool).length;
  const wrongToolCalls = toolRequiredResults.filter((result) => result.wrongTool).length;
  const taskSuccessCount = results.filter((result) => result.taskSuccess).length;
  const toolExecutionDenominator = toolRequiredResults.filter((result) => result.toolsUsed.length > 0).length;
  const toolExecutionSuccessCount = toolRequiredResults.filter((result) => result.toolMatch && result.taskSuccess).length;

  const avgLatency = mean(results.map((result) => result.latencyMs));
  const avgToolLatency = mean(toolRequiredResults.map((result) => result.latencyMs));

  return {
    totalCases,
    directEndpointCount: directEndpointResults.length,
    correctToolCalls,
    missingToolCalls,
    wrongToolCalls,
    toolCallingSuccessRate: percent(correctToolCalls, toolRequiredResults.length),
    toolExecutionSuccessRate: percent(toolExecutionSuccessCount, toolExecutionDenominator),
    wrongToolCallRate: percent(wrongToolCalls, toolRequiredResults.length),
    missingToolCallRate: percent(missingToolCalls, toolRequiredResults.length),
    taskSuccessRate: percent(taskSuccessCount, totalCases),
    avgLatencyMs: avgLatency,
    avgToolLatencyMs: avgToolLatency,
    successfulToolExecutions: toolExecutionSuccessCount,
    totalToolExecutions: toolExecutionDenominator,
    taskSuccessCount,
  };
}

function niceStep(maxValue, steps = 5) {
  if (!Number.isFinite(maxValue) || maxValue <= 0) {
    return 1;
  }

  const raw = maxValue / steps;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const niceNormalized =
    normalized <= 1 ? 1 :
    normalized <= 2 ? 2 :
    normalized <= 5 ? 5 : 10;

  return niceNormalized * magnitude;
}

function getTicks(maxValue, steps = 5) {
  const step = niceStep(maxValue, steps);
  const finalMax = Math.ceil(maxValue / step) * step;
  const ticks = [];
  for (let value = 0; value <= finalMax + 0.0001; value += step) {
    ticks.push(value);
  }
  if (ticks[ticks.length - 1] !== finalMax) {
    ticks.push(finalMax);
  }
  return { step, finalMax, ticks };
}

function wrapLabel(text, maxChars = 16) {
  const words = String(text).split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    return [String(text)];
  }

  const lines = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [String(text)];
}

function renderBarChartSvg({
  title,
  subtitle,
  labels,
  series,
  ySuffix,
  yMax: providedYMax,
}) {
  const width = 1200;
  const height = 720;
  const margin = { top: 110, right: 40, bottom: 150, left: 90 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const numericValues = series.flatMap((item) => item.values.filter((value) => Number.isFinite(value)));
  const yMax = providedYMax ?? Math.max(...numericValues, 0);
  const { finalMax, ticks } = getTicks(Math.max(yMax, 1), 5);
  const slotWidth = labels.length > 0 ? plotWidth / labels.length : plotWidth;
  const seriesCount = Math.max(series.length, 1);
  const barGroupWidth = Math.min(slotWidth * 0.75, 110);
  const barWidth = Math.max(18, barGroupWidth / seriesCount);

  const gridLines = ticks.map((tick) => {
    const ratio = tick / finalMax;
    const y = margin.top + plotHeight - ratio * plotHeight;
    return { tick, y };
  });

  const legend = series.length > 1
    ? series.map((item, index) => ({
        name: item.name,
        color: item.color,
        x: width - margin.right - 240 + index * 120,
      }))
    : [];

  const bars = labels.map((label, index) => {
    const slotCenter = margin.left + slotWidth * index + slotWidth / 2;
    const startX = slotCenter - (barGroupWidth / 2);
    return series.map((item, seriesIndex) => {
      const value = item.values[index];
      const x = startX + seriesIndex * barWidth;
      const barX = x + (barWidth - 18) / 2;
      const numericValue = Number.isFinite(value) ? value : null;
      const barHeight = numericValue === null ? 14 : Math.max(1, (numericValue / finalMax) * plotHeight);
      const y = numericValue === null ? margin.top + plotHeight - 14 : margin.top + plotHeight - barHeight;

      return {
        label,
        seriesName: item.name,
        color: item.color,
        x: barX,
        y,
        width: 18,
        height: barHeight,
        value: numericValue,
        formatted: numericValue === null
          ? 'N/A'
          : ySuffix === '%' ? formatPercent(numericValue) : formatLatency(numericValue),
        isNa: numericValue === null,
      };
    });
  }).flat();

  const svgParts = [];
  svgParts.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  svgParts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">`);
  svgParts.push(`<title id="title">${escapeHtml(title)}</title>`);
  svgParts.push(`<desc id="desc">${escapeHtml(subtitle)}</desc>`);
  svgParts.push(`<defs>
    <style>
      .title { font: 700 28px Inter, Arial, sans-serif; fill: #0f172a; }
      .subtitle { font: 400 14px Inter, Arial, sans-serif; fill: #475569; }
      .axis { stroke: #94a3b8; stroke-width: 1.4; }
      .grid { stroke: #e2e8f0; stroke-width: 1; }
      .tick { font: 12px Inter, Arial, sans-serif; fill: #64748b; }
      .label { font: 12px Inter, Arial, sans-serif; fill: #334155; }
      .value { font: 700 12px Inter, Arial, sans-serif; fill: #0f172a; }
      .legend { font: 600 12px Inter, Arial, sans-serif; fill: #334155; }
    </style>
  </defs>`);
  svgParts.push(`<rect x="0" y="0" width="${width}" height="${height}" rx="26" fill="#ffffff"/>`);
  svgParts.push(`<text x="${margin.left}" y="42" class="title">${escapeHtml(title)}</text>`);
  svgParts.push(`<text x="${margin.left}" y="68" class="subtitle">${escapeHtml(subtitle)}</text>`);

  legend.forEach((item) => {
    svgParts.push(`<rect x="${item.x}" y="28" width="12" height="12" rx="3" fill="${item.color}"/>`);
    svgParts.push(`<text x="${item.x + 18}" y="38" class="legend">${escapeHtml(item.name)}</text>`);
  });

  gridLines.forEach((line) => {
    svgParts.push(`<line x1="${margin.left}" y1="${line.y}" x2="${width - margin.right}" y2="${line.y}" class="grid"/>`);
    svgParts.push(`<text x="${margin.left - 12}" y="${line.y + 4}" text-anchor="end" class="tick">${ySuffix === '%' ? `${line.tick.toFixed(0)}%` : `${Math.round(line.tick).toLocaleString('id-ID')} ms`}</text>`);
  });

  svgParts.push(`<line x1="${margin.left}" y1="${margin.top + plotHeight}" x2="${width - margin.right}" y2="${margin.top + plotHeight}" class="axis"/>`);
  svgParts.push(`<line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${margin.top + plotHeight}" class="axis"/>`);

  labels.forEach((label, index) => {
    const slotCenter = margin.left + slotWidth * index + slotWidth / 2;
    const y = margin.top + plotHeight + 26;
    const lines = wrapLabel(label, 18);
    lines.forEach((line, lineIndex) => {
      svgParts.push(`<text x="${slotCenter}" y="${y + lineIndex * 14}" text-anchor="middle" class="label">${escapeHtml(line)}</text>`);
    });
  });

  bars.forEach((bar) => {
    if (bar.isNa) {
      svgParts.push(`<rect x="${bar.x}" y="${bar.y}" width="${bar.width}" height="${bar.height}" rx="4" fill="#e2e8f0" stroke="#94a3b8" stroke-dasharray="4 3"/>`);
      svgParts.push(`<text x="${bar.x + bar.width / 2}" y="${bar.y - 5}" text-anchor="middle" class="value">N/A</text>`);
      return;
    }

    svgParts.push(`<rect x="${bar.x}" y="${bar.y}" width="${bar.width}" height="${bar.height}" rx="4" fill="${bar.color}"/>`);
    svgParts.push(`<text x="${bar.x + bar.width / 2}" y="${bar.y - 6}" text-anchor="middle" class="value">${escapeHtml(bar.formatted)}</text>`);
  });

  svgParts.push(`<text x="${width - margin.right}" y="${height - 20}" text-anchor="end" class="subtitle">${escapeHtml(ySuffix === '%' ? 'Rates shown in percent' : 'Latency shown in milliseconds')}</text>`);
  svgParts.push(`</svg>`);

  return svgParts.join('\n');
}

async function writePngFromSvg(svg, outputFile) {
  await sharp(Buffer.from(svg)).png().toFile(outputFile);
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
    // Ignore missing files. The phase 2 directory can still be created with README only.
  }
}

function buildPerNurseResults(input) {
  return ensureArray(input.users).map((user) => {
    const stages = {};
    const stageOrder = [];

    for (const stage of STAGES) {
      const evaluated = evaluateStage(user, stage);
      stages[stage.key] = evaluated;
      stageOrder.push(evaluated);
    }

    return {
      nurseUsername: user.nurseUsername ?? null,
      nurseFullName: user.nurseFullName ?? null,
      patientName: user.patientName ?? null,
      noRm: user.noRm ?? null,
      registrationId: user.registrationId ?? null,
      doctorName: user.doctorName ?? null,
      stages,
      stageOrder,
    };
  });
}

function buildStageSummaries(perNurseResults) {
  return STAGES.map((stage) => {
    const stageResults = perNurseResults.map((item) => item.stages[stage.key]);
    const aggregated = aggregateStageResults(stageResults);

    return {
      key: stage.key,
      label: stage.label,
      expectedTool: stage.expectedTool,
      toolMode: stage.toolMode,
      totalCases: aggregated.totalCases,
      correctToolCalls: stage.requiresTool ? aggregated.correctToolCalls : null,
      missingToolCalls: stage.requiresTool ? aggregated.missingToolCalls : null,
      wrongToolCalls: stage.requiresTool ? aggregated.wrongToolCalls : null,
      toolCallingSuccessRate: stage.requiresTool ? aggregated.toolCallingSuccessRate : null,
      toolExecutionSuccessRate: stage.requiresTool ? aggregated.toolExecutionSuccessRate : null,
      wrongToolCallRate: stage.requiresTool ? aggregated.wrongToolCallRate : null,
      missingToolCallRate: stage.requiresTool ? aggregated.missingToolCallRate : null,
      taskSuccessRate: aggregated.taskSuccessRate,
      averageLatencyMs: aggregated.avgLatencyMs,
      averageToolLatencyMs: stage.requiresTool ? aggregated.avgToolLatencyMs : null,
      successfulToolExecutions: stage.requiresTool ? aggregated.successfulToolExecutions : null,
      totalToolExecutions: stage.requiresTool ? aggregated.totalToolExecutions : null,
      taskSuccessCount: aggregated.taskSuccessCount,
      directEndpoint: !stage.requiresTool,
    };
  });
}

function buildOverallSummary(stageSummaries) {
  const toolStages = stageSummaries.filter((stage) => !stage.directEndpoint);
  const allStages = stageSummaries;

  const totalCases = sum(stageSummaries.map((stage) => stage.totalCases));
  const requiredToolCalls = sum(toolStages.map((stage) => stage.totalCases));
  const correctToolCalls = sum(toolStages.map((stage) => stage.correctToolCalls ?? 0));
  const missingToolCalls = sum(toolStages.map((stage) => stage.missingToolCalls ?? 0));
  const wrongToolCalls = sum(toolStages.map((stage) => stage.wrongToolCalls ?? 0));
  const successfulToolExecutions = sum(toolStages.map((stage) => stage.successfulToolExecutions ?? 0));
  const totalToolExecutions = sum(toolStages.map((stage) => stage.totalToolExecutions ?? 0));
  const taskSuccessCount = sum(stageSummaries.map((stage) => stage.taskSuccessCount));

  const avgToolLatency = weightedMean(
    toolStages.map((stage) => stage.averageLatencyMs),
    toolStages.map((stage) => stage.totalCases)
  );
  const avgOverallLatency = weightedMean(
    allStages.map((stage) => stage.averageLatencyMs),
    allStages.map((stage) => stage.totalCases)
  );

  return {
    totalCases,
    requiredToolCalls,
    correctToolCalls,
    missingToolCalls,
    wrongToolCalls,
    successfulToolExecutions,
    totalToolExecutions,
    taskSuccessCount,
    toolCallingSuccessRate: percent(correctToolCalls, requiredToolCalls),
    toolExecutionSuccessRate: percent(successfulToolExecutions, totalToolExecutions),
    wrongToolCallRate: percent(wrongToolCalls, requiredToolCalls),
    missingToolCallRate: percent(missingToolCalls, requiredToolCalls),
    taskSuccessRate: percent(taskSuccessCount, totalCases),
    avgToolLatencyMs: avgToolLatency,
    avgOverallLatencyMs: avgOverallLatency,
  };
}

function buildSummaryParagraph(totalNurses, overallSummary, stageSummaries) {
  const stageByKey = Object.fromEntries(stageSummaries.map((stage) => [stage.key, stage]));
  const directStage = stageByKey.generate;

  return [
    `The tool-calling performance test was conducted using ${totalNurses} nurse workflow executions.`,
    `Clinical summary, objective summary, and update kondisi pasien each achieved ${formatPercent(overallSummary.toolCallingSuccessRate)} tool-calling success with ${formatPercent(overallSummary.wrongToolCallRate)} wrong tool calls and ${formatPercent(overallSummary.missingToolCallRate)} missing tool calls across the required stages.`,
    `Generate clinical notes is implemented as a direct endpoint (${directStage.expectedTool}) and is therefore reported as N/A for tool-calling metrics while still contributing to task success and latency analysis.`,
    `Across tool-required stages, the weighted average latency was ${formatLatency(overallSummary.avgToolLatencyMs)}; the overall average across all stages was ${formatLatency(overallSummary.avgOverallLatencyMs)}.`,
  ].join(' ');
}

function buildMarkdownTable(stageSummaries) {
  const header = [
    '| Workflow Stage | Expected Tool | Total Cases | Correct Tool Calls | Missing Tool Calls | Wrong Tool Calls | Tool-Calling Success Rate | Task Success Rate | Average Latency |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|',
  ];

  const rows = stageSummaries.map((stage) => {
    const expectedTool = stage.directEndpoint ? 'Direct endpoint / N/A' : stage.expectedTool;
    const toolCallingSuccessRate = stage.directEndpoint ? 'N/A' : formatPercent(stage.toolCallingSuccessRate);
    const correct = stage.directEndpoint ? 'N/A' : stage.correctToolCalls;
    const missing = stage.directEndpoint ? 'N/A' : stage.missingToolCalls;
    const wrong = stage.directEndpoint ? 'N/A' : stage.wrongToolCalls;
    return `| ${stage.label} | ${expectedTool} | ${stage.totalCases} | ${correct} | ${missing} | ${wrong} | ${toolCallingSuccessRate} | ${formatPercent(stage.taskSuccessRate)} | ${formatLatency(stage.averageLatencyMs)} |`;
  });

  return [...header, ...rows].join('\n');
}

function buildCsv(stageSummaries) {
  const rows = [
    [
      'Workflow Stage',
      'Expected Tool',
      'Total Cases',
      'Correct Tool Calls',
      'Missing Tool Calls',
      'Wrong Tool Calls',
      'Tool-Calling Success Rate',
      'Tool Execution Success Rate',
      'Wrong Tool Call Rate',
      'Missing Tool Call Rate',
      'Task Success Rate',
      'Average Latency (ms)',
      'Notes',
    ],
  ];

  for (const stage of stageSummaries) {
    rows.push([
      stage.label,
      stage.directEndpoint ? 'Direct endpoint / N/A' : stage.expectedTool,
      stage.totalCases,
      stage.directEndpoint ? 'N/A' : stage.correctToolCalls,
      stage.directEndpoint ? 'N/A' : stage.missingToolCalls,
      stage.directEndpoint ? 'N/A' : stage.wrongToolCalls,
      stage.directEndpoint ? 'N/A' : formatPercent(stage.toolCallingSuccessRate),
      stage.directEndpoint ? 'N/A' : formatPercent(stage.toolExecutionSuccessRate),
      stage.directEndpoint ? 'N/A' : formatPercent(stage.wrongToolCallRate),
      stage.directEndpoint ? 'N/A' : formatPercent(stage.missingToolCallRate),
      formatPercent(stage.taskSuccessRate),
      round1(stage.averageLatencyMs ?? 0),
      stage.directEndpoint ? 'Direct endpoint; excluded from tool-calling denominator.' : 'Tool-calling stage.',
    ]);
  }

  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function buildLatexTable(stageSummaries) {
  const rows = stageSummaries.map((stage) => {
    const expectedTool = stage.directEndpoint ? 'Direct endpoint / N/A' : stage.expectedTool;
    const correct = stage.directEndpoint ? 'N/A' : stage.correctToolCalls;
    const missing = stage.directEndpoint ? 'N/A' : stage.missingToolCalls;
    const wrong = stage.directEndpoint ? 'N/A' : stage.wrongToolCalls;
    const toolCallingSuccessRate = stage.directEndpoint ? 'N/A' : formatPercent(stage.toolCallingSuccessRate);
    return `${escapeLatex(stage.label)} & ${escapeLatex(expectedTool)} & ${stage.totalCases} & ${correct} & ${missing} & ${wrong} & ${escapeLatex(toolCallingSuccessRate)} & ${escapeLatex(formatPercent(stage.taskSuccessRate))} & ${escapeLatex(formatLatency(stage.averageLatencyMs))} \\`;
  });

  return String.raw`\begin{table}[htbp]
\centering
\small
\begin{tabular}{l l r r r r r r r}
\hline
Workflow Stage & Expected Tool & Total Cases & Correct Tool Calls & Missing Tool Calls & Wrong Tool Calls & Tool-Calling Success Rate & Task Success Rate & Average Latency \\
\hline
${rows.join('\n')}
\hline
\end{tabular}
\caption{Phase 3 tool-calling evaluation across workflow stages. Generate clinical notes is treated as a direct endpoint and excluded from tool-calling denominators.}
\label{tab:phase3-tool-calling}
\end{table}`;
}

function buildDashboardHtml({ inputFile, totalNurses, overallSummary, stageSummaries, perNurseResults }) {
  const summaryParagraph = buildSummaryParagraph(totalNurses, overallSummary, stageSummaries);
  const cards = [
    { label: 'Nurse runs', value: totalNurses },
    { label: 'Required tool calls', value: overallSummary.requiredToolCalls },
    { label: 'Tool-calling success', value: formatPercent(overallSummary.toolCallingSuccessRate) },
    { label: 'Tool execution success', value: formatPercent(overallSummary.toolExecutionSuccessRate) },
    { label: 'Wrong tool call rate', value: formatPercent(overallSummary.wrongToolCallRate) },
    { label: 'Missing tool call rate', value: formatPercent(overallSummary.missingToolCallRate) },
    { label: 'Avg tool latency', value: formatLatency(overallSummary.avgToolLatencyMs) },
    { label: 'Avg overall latency', value: formatLatency(overallSummary.avgOverallLatencyMs) },
  ];

  const stageRows = stageSummaries.map((stage) => `
    <tr>
      <td>${escapeHtml(stage.label)}</td>
      <td>${escapeHtml(stage.directEndpoint ? 'Direct endpoint / N/A' : stage.expectedTool)}</td>
      <td>${stage.totalCases}</td>
      <td>${stage.directEndpoint ? 'N/A' : escapeHtml(stage.correctToolCalls)}</td>
      <td>${stage.directEndpoint ? 'N/A' : escapeHtml(stage.missingToolCalls)}</td>
      <td>${stage.directEndpoint ? 'N/A' : escapeHtml(stage.wrongToolCalls)}</td>
      <td>${stage.directEndpoint ? 'N/A' : escapeHtml(formatPercent(stage.toolCallingSuccessRate))}</td>
      <td>${escapeHtml(formatPercent(stage.taskSuccessRate))}</td>
      <td>${escapeHtml(formatLatency(stage.averageLatencyMs))}</td>
    </tr>
  `).join('');

  const nurseRows = perNurseResults.map((item) => {
    const summary = item.stages.summary;
    const objective = item.stages.objective;
    const update = item.stages.update;
    const generate = item.stages.generate;
    return `
      <tr>
        <td>${escapeHtml(item.nurseUsername)}</td>
        <td>${escapeHtml(item.patientName)}</td>
        <td>${escapeHtml(item.doctorName)}</td>
        <td>${escapeHtml(summary.toolMatch ? 'OK' : summary.missingTool ? 'Missing' : 'Wrong')}</td>
        <td>${escapeHtml(objective.toolMatch ? 'OK' : objective.missingTool ? 'Missing' : 'Wrong')}</td>
        <td>${escapeHtml(update.toolMatch ? 'OK' : update.missingTool ? 'Missing' : 'Wrong')}</td>
        <td>${escapeHtml(formatLatency(mean([summary.latencyMs, objective.latencyMs, update.latencyMs, generate.latencyMs])))}</td>
      </tr>
    `;
  }).join('');

  return `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Phase 3 Tool-Calling Dashboard</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f5f7fb;
      --panel: #ffffff;
      --line: #d8e1eb;
      --text: #0f172a;
      --muted: #64748b;
      --accent: #0f766e;
      --accent-2: #2563eb;
      --warn: #b45309;
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
    .meta-value { font-size: 20px; font-weight: 700; }
    .callout { padding: 16px; border-radius: 14px; background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; }
    .section { padding: 20px; margin-top: 18px; }
    .section h2 { margin: 0 0 12px; font-size: 20px; }
    .section p { margin: 0 0 14px; color: var(--muted); }
    .chart-grid { display: grid; gap: 18px; }
    .chart-card { padding: 16px; border: 1px solid var(--line); border-radius: 16px; background: #fff; }
    .chart-card img { width: 100%; height: auto; display: block; border-radius: 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; }
    thead th {
      text-align: left;
      padding: 12px 10px;
      border-bottom: 1px solid var(--line);
      color: #334155;
      background: #f8fafc;
      position: sticky;
      top: 0;
      z-index: 1;
    }
    tbody td { padding: 10px; border-bottom: 1px solid #e8eef5; vertical-align: top; }
    tbody tr:hover { background: #f8fafc; }
    .table-wrap { overflow: auto; max-height: 620px; border: 1px solid var(--line); border-radius: 14px; }
    .tag { display: inline-flex; padding: 4px 10px; border-radius: 999px; background: #ecfeff; color: #0f766e; font-size: 12px; font-weight: 700; }
    .subtle { color: var(--muted); font-size: 13px; }
    .two-col { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 18px; }
    @media (max-width: 1100px) {
      .hero, .two-col, .meta-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="hero">
      <div class="panel hero-main">
        <span class="tag">Phase 3 - Tool Calling Evaluation</span>
        <h1>Workflow Tool-Calling Results</h1>
        <p class="subtitle">${escapeHtml(summaryParagraph)}</p>
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
        <div class="callout">
          <strong>Direct endpoint note</strong><br/>
          Generate clinical notes is evaluated as a direct endpoint. It is kept in the table and latency chart, but not counted in tool-calling denominators.
        </div>
        <div class="subtle">
          Source file: <code>${escapeHtml(path.relative(PROJECT_ROOT, inputFile))}</code><br/>
          Nurses evaluated: <strong>${totalNurses}</strong><br/>
          Required tool stages: <strong>${STAGES.filter((stage) => stage.requiresTool).length}</strong>
        </div>
      </div>
    </div>

    <div class="panel section">
      <h2>Charts</h2>
      <p>Success rate, error rate, and latency views used for the paper figures.</p>
      <div class="chart-grid">
        <div class="chart-card"><img src="./phase3_tool_success_rate.png" alt="Tool-Calling Success Rate per Stage" /></div>
        <div class="chart-card"><img src="./phase3_tool_error_rate.png" alt="Tool-Calling Error Rate per Stage" /></div>
        <div class="chart-card"><img src="./phase3_tool_latency.png" alt="Average Latency per Tool-Calling Stage" /></div>
      </div>
    </div>

    <div class="two-col">
      <div class="panel section">
        <h2>Stage Summary</h2>
        <p>Main table for paper insertion.</p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Workflow Stage</th>
                <th>Expected Tool</th>
                <th>Total Cases</th>
                <th>Correct Tool Calls</th>
                <th>Missing Tool Calls</th>
                <th>Wrong Tool Calls</th>
                <th>Tool-Calling Success Rate</th>
                <th>Task Success Rate</th>
                <th>Average Latency</th>
              </tr>
            </thead>
            <tbody>
              ${stageRows}
            </tbody>
          </table>
        </div>
      </div>

      <div class="panel section">
        <h2>Per-Nurse Snapshot</h2>
        <p>Quick view of each nurse run and latency.</p>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nurse</th>
                <th>Patient</th>
                <th>Doctor</th>
                <th>Summary</th>
                <th>Objective</th>
                <th>Update</th>
                <th>Avg Latency</th>
              </tr>
            </thead>
            <tbody>
              ${nurseRows}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function prepareOrganizedFolders() {
  await fs.mkdir(ORGANIZED_DIRS.phase2, { recursive: true });
  await fs.mkdir(ORGANIZED_DIRS.phase3, { recursive: true });

  const phase2Files = [
    'workflow_report.md',
    'workflow_results.json',
    'workflow_dashboard.html',
    'workflow_latency.svg',
    'workflow_success_rate.svg',
  ];

  for (const fileName of phase2Files) {
    const source = path.join(RESULTS_DIR, fileName);
    const target = path.join(ORGANIZED_DIRS.phase2, fileName);
    await copyIfExists(source, target);
  }

  const phase2Readme = `# Phase 2 Workflow Evaluation

This folder groups the workflow execution test outputs.

- \`workflow_report.md\`: narrative workflow evaluation report
- \`workflow_results.json\`: structured workflow execution results
- \`workflow_dashboard.html\`: visual dashboard
- \`workflow_latency.svg\`: latency chart
- \`workflow_success_rate.svg\`: success-rate chart

Primary files still exist at the top level of \`evaluation/results/\` for compatibility.`;
  await writeTextFile(path.join(ORGANIZED_DIRS.phase2, 'README.md'), phase2Readme);

  const phase3Readme = `# Phase 3 Tool-Calling Evaluation

This folder groups the tool-calling analysis outputs.

- \`phase3_tool_calling_results.json\`: full per-nurse/per-stage analysis
- \`phase3_tool_calling_summary.csv\`: paper-ready stage summary in CSV
- \`phase3_tool_calling_summary.md\`: Markdown table and narrative summary
- \`phase3_tool_calling_table_latex.tex\`: LaTeX table for manuscripts
- \`phase3_tool_success_rate.png\`: success-rate chart
- \`phase3_tool_error_rate.png\`: error-rate chart
- \`phase3_tool_latency.png\`: latency chart
- \`phase3_tool_calling_dashboard.html\`: visual dashboard

Generate clinical notes is treated as a direct endpoint and excluded from tool-calling denominators.`;
  await writeTextFile(path.join(ORGANIZED_DIRS.phase3, 'README.md'), phase3Readme);

  for (const [key, filePath] of Object.entries(ROOT_OUTPUTS)) {
    await copyIfExists(filePath, path.join(ORGANIZED_DIRS.phase3, path.basename(filePath)));
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let raw;
  try {
    raw = await fs.readFile(args.inputFile, 'utf8');
  } catch {
    throw new Error(`Input JSON not found: ${path.relative(PROJECT_ROOT, args.inputFile)}. Run phase 2 first or pass --input=<path>.`);
  }

  let input;
  try {
    input = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Failed to parse input JSON: ${error instanceof Error ? error.message : String(error)}`);
  }

  const perNurseResults = buildPerNurseResults(input);
  const stageSummaries = buildStageSummaries(perNurseResults);
  const overallSummary = buildOverallSummary(stageSummaries);
  const totalNurses = toNumber(input.totalNurses) ?? perNurseResults.length;
  const generatedAt = new Date().toISOString();

  const output = {
    generatedAt,
    sourceFile: path.relative(PROJECT_ROOT, args.inputFile),
    totalNurses,
    auditSummary: input.auditSummary ?? null,
    overallSummary,
    stageSummaries,
    perNurseResults,
    notes: {
      generateClinicalNotes: 'Direct endpoint / N/A for tool-calling metrics; included in task success and latency only.',
    },
  };

  const markdownTable = buildMarkdownTable(stageSummaries);
  const csv = buildCsv(stageSummaries);
  const latex = buildLatexTable(stageSummaries);
  const summaryParagraph = buildSummaryParagraph(totalNurses, overallSummary, stageSummaries);

  const chartSuccess = renderBarChartSvg({
    title: 'Tool-Calling Success Rate per Stage',
    subtitle: 'Generate clinical notes is a direct endpoint and therefore shown as N/A in tool-calling metrics.',
    labels: stageSummaries.map((stage) => stage.label),
    series: [
      {
        name: 'Tool-calling success rate',
        color: '#0f766e',
        values: stageSummaries.map((stage) => (stage.directEndpoint ? null : stage.toolCallingSuccessRate)),
      },
    ],
    ySuffix: '%',
    yMax: 100,
  });

  const chartError = renderBarChartSvg({
    title: 'Tool-Calling Error Rate per Stage',
    subtitle: 'Missing and wrong tool calls are measured only for stages that require a tool.',
    labels: stageSummaries.map((stage) => stage.label),
    series: [
      {
        name: 'Missing tool call rate',
        color: '#dc2626',
        values: stageSummaries.map((stage) => (stage.directEndpoint ? null : stage.missingToolCallRate)),
      },
      {
        name: 'Wrong tool call rate',
        color: '#b45309',
        values: stageSummaries.map((stage) => (stage.directEndpoint ? null : stage.wrongToolCallRate)),
      },
    ],
    ySuffix: '%',
    yMax: 100,
  });

  const chartLatency = renderBarChartSvg({
    title: 'Average Latency per Tool-Calling Stage',
    subtitle: 'Latency is shown for all workflow stages, including the direct endpoint.',
    labels: stageSummaries.map((stage) => stage.label),
    series: [
      {
        name: 'Average latency',
        color: '#2563eb',
        values: stageSummaries.map((stage) => stage.averageLatencyMs),
      },
    ],
    ySuffix: 'ms',
  });

  await fs.mkdir(args.outputDir, { recursive: true });

  await fs.writeFile(ROOT_OUTPUTS.json, JSON.stringify(output, null, 2), 'utf8');
  await fs.writeFile(ROOT_OUTPUTS.csv, csv, 'utf8');
  await fs.writeFile(ROOT_OUTPUTS.md, `# Phase 3 Tool-Calling Evaluation\n\n${summaryParagraph}\n\n${markdownTable}\n`, 'utf8');
  await fs.writeFile(ROOT_OUTPUTS.tex, latex, 'utf8');
  await writePngFromSvg(chartSuccess, ROOT_OUTPUTS.successPng);
  await writePngFromSvg(chartError, ROOT_OUTPUTS.errorPng);
  await writePngFromSvg(chartLatency, ROOT_OUTPUTS.latencyPng);
  await fs.writeFile(ROOT_OUTPUTS.html, buildDashboardHtml({
    inputFile: args.inputFile,
    totalNurses,
    overallSummary,
    stageSummaries,
    perNurseResults,
  }), 'utf8');

  await prepareOrganizedFolders();

  console.log(`Phase 3 tool-calling evaluation complete.`);
  console.log(`Input: ${path.relative(PROJECT_ROOT, args.inputFile)}`);
  console.log(`Output files written to ${path.relative(PROJECT_ROOT, RESULTS_DIR)} and organized folders under evaluation/results/phase2_workflow and evaluation/results/phase3_tool_calling.`);
  console.log(`Generate clinical notes: direct endpoint / N/A for tool-calling metrics.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
