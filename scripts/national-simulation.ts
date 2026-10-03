import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { rawDigest } from '../packages/tse/src/index';
import { simulateNational, type ModelUnit } from '../packages/tse/src/national-model';
const benchmark = JSON.parse(readFileSync('docs/evidence/national/benchmark.json', 'utf8'));
const capturedPath = `${benchmark.directory}/${benchmark.catalogHash}.json`;
const rawCatalog = readFileSync(
  existsSync(capturedPath) ? capturedPath : 'packages/fixtures/simulado/ea12.json',
  'utf8',
);
if (rawDigest(rawCatalog) !== benchmark.catalogHash)
  throw Error('Cadastro não corresponde à medição');
const catalog = JSON.parse(rawCatalog);
const units: ModelUnit[] = catalog.abr.flatMap((a: any) =>
  a.mu.flatMap((m: any, i: number) =>
    m.z.map((z: string) => ({
      key: `${a.cd}:${m.cd}:${z}`,
      municipality: `${a.cd}:${m.cd}`,
      zone: `${a.cd}:${z}`,
      multi: m.z.length > 1,
      favorite: i === 0 && a.cd !== 'zz',
    })),
  ),
);
const http = benchmark.records
  .filter((r: any) => r.kind === 'EA20-zone' && r.status === 200)
  .map((r: any) => r.httpMs);
if (!http.length) throw Error('Sem medidas HTTP zonais');
const results = [];
for (const rps of [2, 5, 10, 20])
  for (const scenario of ['progressive', 'burst', 'failures']) {
    const options = {
      rps,
      concurrency: 16,
      httpMs: http,
      processingMs: benchmark.offlineProcessMs.mean,
      queueSaveMs: 0,
      burst: scenario !== 'progressive',
      failures: scenario === 'failures',
      priority: true,
      hints: true,
    };
    results.push({
      scenario,
      implementation: 'hypothetical-incremental-save',
      options,
      ...simulateNational(units, options),
    });
  }
for (const variant of ['current', 'no-priority', 'no-hints', 'no-hints-same-fallback']) {
  const options = {
    rps: 20,
    concurrency: variant === 'current' ? 1 : 16,
    httpMs: http,
    processingMs: benchmark.offlineProcessMs.mean,
    queueSaveMs: variant === 'current' ? benchmark.fullQueueSaveMs.mean : 0,
    burst: true,
    failures: false,
    priority: variant !== 'no-priority',
    hints: !variant.startsWith('no-hints'),
    pendingSweepSeconds: variant === 'no-hints-same-fallback' ? 900 : undefined,
  };
  results.push({
    scenario: variant,
    implementation:
      variant === 'current' ? 'measured-current-save' : 'hypothetical-incremental-save',
    options,
    ...simulateNational(units, options),
  });
}
writeFileSync(
  'docs/evidence/national/simulation.json',
  JSON.stringify(
    {
      seed: 'deterministic-index-37',
      catalogHash: benchmark.catalogHash,
      units: units.length,
      assumptions: {
        durationSeconds: 7200,
        concurrencyHypothesis: 16,
        EA15Seconds: 30,
        EA14Seconds: 15,
        aggregateSeconds: 60,
        pendingFallbackSeconds: 900,
        completedAuditSeconds: 600,
        hints: 'Nominal cadence without extra EA15 queue delay: optimistic bound',
        matching:
          'All observed completed segments assumed matchable, not proof of actual reconciliation',
        snapshot:
          'Available to application only at request completion; no retrospective cohort insertion',
      },
      results,
    },
    null,
    2,
  ),
);
console.log(
  results.map((r) => ({
    scenario: r.scenario,
    rps: r.options.rps,
    sent: r.sent,
    queue: r.maxQueue,
    remaining: r.remaining,
    completed: r.completeSegments,
    p95: r.detectedToPersistence.p95,
  })),
);
