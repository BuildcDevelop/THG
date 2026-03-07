import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptFile = fileURLToPath(import.meta.url);
const scriptsDir = path.dirname(scriptFile);
const repoRoot = path.resolve(scriptsDir, '..');
const scenarioRunnerPath = path.join(repoRoot, 'tests', 'regression', 'game-rules.scenario.mjs');
const outputDir = path.join(repoRoot, 'artifacts', 'perf');
const latestReportPath = path.join(outputDir, 'stage6-metrics-latest.json');
const latestComparisonPath = path.join(outputDir, 'stage6-metrics-comparison-latest.json');

const toNumber = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const round = (value, decimals = 4) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const reductionPct = (fullValue, summaryValue) => {
  const full = Math.max(0, toNumber(fullValue, 0));
  const summary = Math.max(0, toNumber(summaryValue, 0));
  if (full <= 0) {
    return 0;
  }
  return round(((full - summary) / full) * 100, 2);
};

const readJsonSafe = (filePath) => {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const runScenario = (scenarioName) => {
  const tempDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tld-stage6-metrics-'));
  const env = {
    ...process.env,
    TLD_DATA_DIR: tempDataDir,
  };

  try {
    const run = spawnSync(process.execPath, [scenarioRunnerPath, String(scenarioName)], {
      cwd: repoRoot,
      env,
      encoding: 'utf8',
    });

    if (run.status !== 0) {
      const details = [
        `Scenario '${scenarioName}' failed.`,
        `Exit code: ${run.status ?? 'null'}`,
        `stdout:\n${run.stdout ?? ''}`,
        `stderr:\n${run.stderr ?? ''}`,
      ].join('\n');
      throw new Error(details);
    }

    const stdout = String(run.stdout ?? '').trim();
    const outputLine = stdout.split(/\r?\n/).filter(Boolean).at(-1);
    if (!outputLine) {
      throw new Error(`Scenario '${scenarioName}' produced no JSON output.`);
    }

    return JSON.parse(outputLine);
  } finally {
    fs.rmSync(tempDataDir, { recursive: true, force: true });
  }
};

const compareMetrics = (currentMetrics, previousMetrics) => {
  if (!previousMetrics || typeof previousMetrics !== 'object') {
    return null;
  }

  const keys = Object.keys(currentMetrics).filter((key) => typeof currentMetrics[key] === 'number');
  const deltaByMetric = {};
  for (const key of keys) {
    const current = toNumber(currentMetrics[key], 0);
    const previous = toNumber(previousMetrics[key], 0);
    const deltaAbs = round(current - previous, 4);
    const deltaPct = previous === 0 ? null : round((deltaAbs / Math.abs(previous)) * 100, 2);
    deltaByMetric[key] = {
      previous,
      current,
      deltaAbs,
      deltaPct,
    };
  }
  return deltaByMetric;
};

const buildMetrics = ({ summaryScenario, mapScenario, readModelScenario }) => {
  const reportsFullBytes = toNumber(summaryScenario?.reports?.fullPayloadBytes, 0);
  const reportsSummaryBytes = toNumber(summaryScenario?.reports?.summaryPayloadBytes, 0);
  const activityFullBytes = toNumber(summaryScenario?.activity?.fullPayloadBytes, 0);
  const activitySummaryBytes = toNumber(summaryScenario?.activity?.summaryPayloadBytes, 0);
  const mapTotalSettlements = toNumber(mapScenario?.totalSettlements, 0);
  const mapRenderedSettlements = toNumber(mapScenario?.renderedSettlements, 0);
  const mapRenderedRatio = toNumber(mapScenario?.renderedRatio, 0);

  const readBeforeMilitia = toNumber(readModelScenario?.beforeRead?.militia, 0);
  const readAfterMilitia = toNumber(readModelScenario?.afterRead?.militia, 0);
  const tickAfterMilitia = toNumber(readModelScenario?.afterTick?.militia, 0);
  const readBeforeQueue = toNumber(readModelScenario?.beforeRead?.inProgressRecruitments, 0);
  const readAfterQueue = toNumber(readModelScenario?.afterRead?.inProgressRecruitments, 0);
  const tickAfterQueue = toNumber(readModelScenario?.afterTick?.inProgressRecruitments, 0);

  return {
    reportsPayloadFullBytes: reportsFullBytes,
    reportsPayloadSummaryBytes: reportsSummaryBytes,
    reportsPayloadReductionBytes: Math.max(0, reportsFullBytes - reportsSummaryBytes),
    reportsPayloadReductionPct: reductionPct(reportsFullBytes, reportsSummaryBytes),
    activityPayloadFullBytes: activityFullBytes,
    activityPayloadSummaryBytes: activitySummaryBytes,
    activityPayloadReductionBytes: Math.max(0, activityFullBytes - activitySummaryBytes),
    activityPayloadReductionPct: reductionPct(activityFullBytes, activitySummaryBytes),
    mapPayloadBytes: toNumber(mapScenario?.mapPayloadBytes, 0),
    mapTotalSettlements,
    mapRenderedSettlements,
    mapRenderedRatioPct: round(mapRenderedRatio * 100, 2),
    mapCulledRatioPct: round((1 - mapRenderedRatio) * 100, 2),
    readModelMilitiaBeforeRead: readBeforeMilitia,
    readModelMilitiaAfterRead: readAfterMilitia,
    readModelMilitiaAfterTick: tickAfterMilitia,
    readModelQueueBeforeRead: readBeforeQueue,
    readModelQueueAfterRead: readAfterQueue,
    readModelQueueAfterTick: tickAfterQueue,
  };
};

const buildGuardrailChecks = (readModelScenario) => {
  const beforeReadMilitia = toNumber(readModelScenario?.beforeRead?.militia, 0);
  const afterReadMilitia = toNumber(readModelScenario?.afterRead?.militia, 0);
  const afterTickMilitia = toNumber(readModelScenario?.afterTick?.militia, 0);
  const beforeReadQueue = toNumber(readModelScenario?.beforeRead?.inProgressRecruitments, 0);
  const afterReadQueue = toNumber(readModelScenario?.afterRead?.inProgressRecruitments, 0);
  const afterTickQueue = toNumber(readModelScenario?.afterTick?.inProgressRecruitments, 0);

  return {
    readModelNoTickMutation: beforeReadMilitia === afterReadMilitia && beforeReadQueue === afterReadQueue,
    readModelTickProcessesQueue: afterTickMilitia > afterReadMilitia && afterTickQueue < afterReadQueue,
  };
};

const ensureOutputDir = () => {
  fs.mkdirSync(outputDir, { recursive: true });
};

const writeJson = (filePath, payload) => {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
};

const run = () => {
  const startedAtMs = Date.now();
  ensureOutputDir();
  const previousLatest = readJsonSafe(latestReportPath);

  const summaryScenario = runScenario('summary-polling-consistency');
  const readModelScenario = runScenario('read-models-no-tick-side-effects');
  const mapScenario = runScenario('map-render-scope-stress');

  const generatedAt = new Date().toISOString();
  const stamp = generatedAt.replace(/[:.]/g, '-');
  const currentFileName = `stage6-metrics-${stamp}.json`;
  const currentReportPath = path.join(outputDir, currentFileName);

  const metrics = buildMetrics({
    summaryScenario,
    mapScenario,
    readModelScenario,
  });
  const guardrailChecks = buildGuardrailChecks(readModelScenario);
  const comparisonByMetric = compareMetrics(metrics, previousLatest?.metrics ?? null);
  const report = {
    schemaVersion: 1,
    generatedAt,
    generatedBy: 'scripts/generate-stage6-metrics-report.mjs',
    durationMs: Date.now() - startedAtMs,
    build: {
      commitRef:
        process.env.GITHUB_SHA ??
        process.env.NETLIFY_COMMIT_REF ??
        process.env.COMMIT_REF ??
        process.env.TLD_BUILD_ID ??
        null,
      branchRef:
        process.env.GITHUB_REF_NAME ??
        process.env.BRANCH ??
        process.env.HEAD ??
        null,
      ciProvider:
        process.env.GITHUB_ACTIONS === 'true'
          ? 'github-actions'
          : process.env.NETLIFY
            ? 'netlify'
            : 'local',
    },
    metrics,
    guardrailChecks,
    raw: {
      summaryScenario,
      readModelScenario,
      mapScenario,
    },
    comparisonToPrevious:
      previousLatest != null
        ? {
            previousGeneratedAt: previousLatest.generatedAt ?? null,
            deltaByMetric: comparisonByMetric,
          }
        : null,
  };

  const comparisonPayload = {
    schemaVersion: 1,
    generatedAt,
    currentReportFile: currentFileName,
    previousReportGeneratedAt: previousLatest?.generatedAt ?? null,
    deltaByMetric: comparisonByMetric,
  };

  writeJson(currentReportPath, report);
  writeJson(latestReportPath, report);
  writeJson(latestComparisonPath, comparisonPayload);

  console.log(`[stage6-report] Current report: ${path.relative(repoRoot, currentReportPath)}`);
  console.log(`[stage6-report] Latest report: ${path.relative(repoRoot, latestReportPath)}`);
  console.log(`[stage6-report] Latest comparison: ${path.relative(repoRoot, latestComparisonPath)}`);
  console.log(
    `[stage6-report] reports reduction=${metrics.reportsPayloadReductionPct}% | activity reduction=${metrics.activityPayloadReductionPct}% | map culled=${metrics.mapCulledRatioPct}%`,
  );
};

try {
  run();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
