import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { Store } from '../apps/api/src/db/store';
import { PersistentCollector } from '../apps/api/src/services/collector';
import { parseZoneRegistry, normalizeZone } from '../packages/tse/src/zones';
import { discoverElection } from '../packages/tse/src/index';
import { summarize } from '../packages/tse/src/national-model';
const b = JSON.parse(readFileSync('docs/evidence/national/benchmark.json', 'utf8'));
const registry = parseZoneRegistry(
  JSON.parse(readFileSync('packages/fixtures/simulado/ea12.json', 'utf8')),
  'simulated',
);
const context = discoverElection(
  JSON.parse(readFileSync('packages/fixtures/simulado/ea11.json', 'utf8')),
  'simulated',
  'president',
);
const record = b.records.find((r: any) => r.kind === 'EA20-zone' && r.status === 200);
const raw = readFileSync(`${b.directory}/${record.hash}.json`, 'utf8');
const match = record.url.match(/\/([a-z]{2})(\d{5})-z(\d{4})-/)!;
const folder = `data/national-local-${Date.now()}`;
mkdirSync(folder, { recursive: true });
const store = new Store(`${folder}/benchmark.sqlite`);
let clock = 0;
try {
  const service = new PersistentCollector(store, () => clock);
  for (const s of registry.segments)
    service.queue.add({
      key: `${s.uf}:${s.municipality}:${s.zone}`,
      url: 'fixture:local-performance',
      kind: 'zone',
      priority: 0,
    });
  service.save();
  const elapsed: number[] = [];
  const start = performance.now();
  for (let i = 0; i < 300; i++) {
    clock = i * 60000;
    const tickStart = performance.now();
    await service.tick(async () => {
      normalizeZone(JSON.parse(raw), {
        ...context,
        uf: match[1],
        municipality: match[2],
        zone: match[3],
        sourceUrl: record.url,
        capturedAt: new Date(clock).toISOString(),
        registry,
        raw,
      });
      return { status: 200, bytes: Buffer.byteLength(raw), raw, etag: 'offline-sample' };
    });
    elapsed.push(performance.now() - tickStart);
  }
  const wallMs = performance.now() - start;
  const result = {
    kind: 'measured_local_no_network',
    requests: 300,
    queueSize: registry.segments.length,
    wallMs,
    throughput: 300 / (wallMs / 1000),
    tickMs: summarize(elapsed),
    assumptions:
      '300 corpos 200 idênticos reaproveitados, gate temporal avançado virtualmente; normalização real do mesmo corpo, seleção/gravações incrementais/cache/observação SQLite reais; sem latência HTTP e sem snapshots normalizados nacionais',
    bodyCount: store.db.prepare('SELECT COUNT(*) n FROM collector_body').get(),
    observations: store.db.prepare('SELECT COUNT(*) n FROM collector_observation').get(),
  };
  writeFileSync(
    process.env.BENCH_OUTPUT ?? 'docs/evidence/national/local-pipeline-optimized.json',
    JSON.stringify(result, null, 2),
  );
  console.log(result);
} finally {
  store.close();
}
