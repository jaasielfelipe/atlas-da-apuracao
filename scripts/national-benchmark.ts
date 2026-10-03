import { readFileSync, writeFileSync, mkdirSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import { gzipSync } from 'node:zlib';
import {
  discoverElection,
  resolveTsePath,
  rawDigest,
  parseTracking,
  normalizeEA20,
} from '../packages/tse/src/index';
import { parseZoneRegistry, normalizeZone } from '../packages/tse/src/zones';
import { Store } from '../apps/api/src/db/store';
import { PersistentCollector } from '../apps/api/src/services/collector';

export const quantiles = (values: number[]) => {
  const a = [...values].sort((a, b) => a - b);
  const q = (p: number) => (a.length ? a[Math.max(0, Math.ceil(p * a.length) - 1)] : null);
  return {
    n: a.length,
    p50: q(0.5),
    p95: q(0.95),
    p99: q(0.99),
    mean: a.length ? a.reduce((s, n) => s + n, 0) / a.length : null,
  };
};
const rps = Number(process.env.BENCH_RPS ?? 2);
if (!Number.isFinite(rps) || rps <= 0 || rps > 20)
  throw Error('BENCH_RPS deve estar entre >0 e 20; padrão 2');
const directory = resolve('data/national-benchmark', new Date().toISOString().replaceAll(':', '-'));
mkdirSync(directory, { recursive: true });
const lock = resolve('data/national-benchmark/active.lock'),
  fd = openSync(lock, 'wx');
const store = new Store(resolve(directory, 'benchmark.sqlite'));
store.db.exec(
  'CREATE TABLE bench_body(hash TEXT PRIMARY KEY, body BLOB NOT NULL); CREATE TABLE bench_capture(id INTEGER PRIMARY KEY,url TEXT,hash TEXT,captured_at TEXT)',
);
const records: any[] = [];
const targets: any[] = [];
let lastStart = -Infinity,
  stopped = false,
  missing = 0;
const persist = () =>
  writeFileSync(resolve(directory, 'requests.json'), JSON.stringify(records, null, 2));
async function request(target: any, mode: 'plain' | 'etag' | 'modified' = 'plain') {
  if (stopped || target.missing) return null;
  const headers: Record<string, string> = {};
  if (mode === 'etag') {
    if (!target.etag) return null;
    headers['If-None-Match'] = target.etag;
  }
  if (mode === 'modified') {
    if (!target.lastModified) return null;
    headers['If-Modified-Since'] = target.lastModified;
  }
  while (performance.now() - lastStart < 1000 / rps)
    await sleep(Math.ceil(1000 / rps - (performance.now() - lastStart)));
  const start = performance.now();
  lastStart = start;
  const row: any = {
    kind: target.kind,
    url: target.url,
    mode,
    startedAt: new Date().toISOString(),
    startMs: start,
    environment: 'simulated',
  };
  try {
    const response = await fetch(target.url, {
      headers,
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
    });
    row.headersMs = performance.now() - start;
    row.status = response.status;
    row.etag = response.headers.get('etag');
    row.lastModified = response.headers.get('last-modified');
    if ([403, 429].includes(response.status)) stopped = true;
    if (response.status === 404) {
      target.missing = true;
      if (++missing >= 2) stopped = true;
    }
    if (Number(response.headers.get('content-length')) > 4 * 1024 * 1024)
      throw Error('Arquivo acima de 4MiB');
    const reader = response.body?.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    if (reader)
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.length;
          if (total > 4 * 1024 * 1024) {
            await reader.cancel();
            throw Error('Arquivo acima de 4MiB');
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
    const bytes = Buffer.concat(chunks);
    row.bytes = bytes.length;
    row.httpMs = performance.now() - start;
    row.downloadMs = row.httpMs - row.headersMs;
    if (response.status === 200) {
      const parseStart = performance.now();
      const json = JSON.parse(bytes.toString('utf8'));
      row.parseMs = performance.now() - parseStart;
      const validateStart = performance.now();
      target.validate(json, bytes.toString('utf8'));
      row.validationMs = performance.now() - validateStart;
      row.hash = rawDigest(bytes.toString('utf8'));
      row.receivedAt = new Date().toISOString();
      const dbStart = performance.now();
      store.db.transaction(() => {
        store.db
          .prepare('INSERT OR IGNORE INTO bench_body VALUES(?,?)')
          .run(row.hash, gzipSync(bytes));
        store.db
          .prepare('INSERT INTO bench_capture(url,hash,captured_at) VALUES(?,?,?)')
          .run(target.url, row.hash, row.receivedAt);
      })();
      row.persistMs = performance.now() - dbStart;
      writeFileSync(resolve(directory, `${row.hash}.json`), bytes);
      target.etag = row.etag;
      target.lastModified = row.lastModified;
      target.json = json;
      target.raw = bytes.toString('utf8');
    }
  } catch (error) {
    row.error = String(error);
    row.httpMs ??= performance.now() - start;
    stopped = true;
  }
  row.elapsedMs = performance.now() - start;
  records.push(row);
  persist();
  console.log(
    `${records.length} ${target.kind} ${mode} ${row.status ?? 'error'} ${row.httpMs.toFixed(1)}ms`,
  );
  return target.json ?? null;
}
try {
  const observation = JSON.parse(readFileSync('packages/fixtures/observation.json', 'utf8'));
  const configTarget = {
    kind: 'EA11',
    url: observation.find((r: any) => r.file === 'simulado/ea11.json').url,
    validate: (j: any) => discoverElection(j, 'simulated', 'president'),
  };
  const config = await request(configTarget);
  if (!config) throw Error('EA11 indisponível');
  const context = discoverElection(config, 'simulated', 'president');
  const catalogTarget = {
    kind: 'EA12',
    url: resolveTsePath('EA12', context),
    validate: (j: any) => parseZoneRegistry(j, 'simulated'),
  };
  const catalog = await request(catalogTarget);
  if (!catalog) throw Error('EA12 indisponível');
  const registry = parseZoneRegistry(catalog, 'simulated');
  targets.push({
    kind: 'EA14',
    url: resolveTsePath('EA14', context),
    validate: (j: any) => parseTracking(j, 'simulated', context.electionId, 'EA14'),
  });
  for (const uf of ['ac', 'ba', 'mg', 'sp', 'am']) {
    targets.push({
      kind: 'EA15',
      url: resolveTsePath('EA15', { ...context, uf }),
      validate: (j: any) => parseTracking(j, 'simulated', context.electionId, 'EA15'),
    });
    const list = catalog.abr.find((a: any) => a.cd === uf).mu;
    for (const municipality of [
      list.find((m: any) => m.z.length === 1),
      list.find((m: any) => m.z.length > 1),
    ].filter(Boolean)) {
      const zonal = { ...context, uf, municipality: municipality.cd, zone: municipality.z[0] };
      const url = resolveTsePath('EA20', zonal);
      targets.push({
        kind: 'EA20-zone',
        url,
        validate: (j: any, raw: string) =>
          normalizeZone(j, {
            ...zonal,
            sourceUrl: url,
            capturedAt: new Date().toISOString(),
            registry,
            raw,
          }),
      });
    }
  }
  for (const uf of ['br', 'ac']) {
    const url = resolveTsePath('EA20', { ...context, uf });
    targets.push({
      kind: 'EA20-aggregate',
      url,
      validate: (j: any, raw: string) =>
        normalizeEA20(j, {
          environment: 'simulated',
          electionId: context.electionId,
          office: 'president',
          territory: {
            id: uf,
            kind: uf === 'br' ? 'br' : 'uf',
            uf: uf === 'br' ? null : uf,
            tseCode: null,
            ibgeCode: null,
            parentId: null,
            name: uf,
          },
          sourceUrl: url,
          capturedAt: new Date().toISOString(),
          raw,
        }),
    });
  }
  for (const t of targets) await request(t);
  for (const mode of ['etag', 'modified'] as const) for (const t of targets) await request(t, mode);
  const dimensions = catalog.abr.map((a: any) => ({
    uf: a.cd,
    entries: a.mu.length,
    single: a.mu.filter((m: any) => m.z.length === 1).length,
    multi: a.mu.filter((m: any) => m.z.length > 1).length,
    segments: a.mu.reduce((n: number, m: any) => n + m.z.length, 0),
    zones: new Set(a.mu.flatMap((m: any) => m.z)).size,
  }));
  const totals = dimensions.reduce((sum: any, row: any) => {
    for (const k of ['entries', 'single', 'multi', 'segments', 'zones'])
      sum[k] = (sum[k] ?? 0) + row[k];
    return sum;
  }, {});
  const multizones = new Map<string, number>();
  for (const s of registry.segments) {
    const key = `${s.uf}:${s.zone}`;
    multizones.set(key, (multizones.get(key) ?? 0) + 1);
  }
  // Measure the actual persistence implementation at national queue size, entirely offline.
  const queue = new PersistentCollector(store, () => 0);
  for (const s of registry.segments)
    queue.queue.add({
      key: `${s.uf}:${s.municipality}:${s.zone}`,
      url: 'fixture:benchmark',
      kind: 'zone',
      priority: 0,
    });
  const saves: number[] = [];
  for (let i = 0; i < 20; i++) {
    const t = performance.now();
    queue.save();
    saves.push(performance.now() - t);
  }
  const processing: number[] = [];
  const zone = targets.find((t) => t.kind === 'EA20-zone' && t.raw);
  if (zone)
    for (let i = 0; i < 200; i++) {
      const t = performance.now();
      const j = JSON.parse(zone.raw);
      zone.validate(j, zone.raw);
      const hash = rawDigest(zone.raw);
      store.db
        .prepare('INSERT OR IGNORE INTO bench_body VALUES(?,?)')
        .run(hash, gzipSync(zone.raw));
      processing.push(performance.now() - t);
    }
  const groups = Object.fromEntries(
    [...new Set(records.map((r) => r.kind))].map((kind) => [
      kind,
      {
        plain: quantiles(
          records
            .filter((r) => r.kind === kind && r.mode === 'plain' && r.status === 200)
            .map((r) => r.httpMs),
        ),
        etag: quantiles(
          records.filter((r) => r.kind === kind && r.mode === 'etag').map((r) => r.httpMs),
        ),
        modified: quantiles(
          records.filter((r) => r.kind === kind && r.mode === 'modified').map((r) => r.httpMs),
        ),
        bytes: quantiles(
          records.filter((r) => r.kind === kind && r.status === 200).map((r) => r.bytes),
        ),
      },
    ]),
  );
  const report = {
    capturedAt: new Date().toISOString(),
    directory,
    rps,
    maximumAllowedRps: 20,
    requestCount: records.length,
    stopped,
    catalogHash: records.find((r) => r.kind === 'EA12')?.hash,
    dimensions,
    totals,
    multiMunicipalityZones: [...multizones.values()].filter((n) => n > 1).length,
    groups,
    statuses: Object.fromEntries(
      [...new Set(records.map((r) => r.status ?? 0))].map((status) => [
        status,
        records.filter((r) => (r.status ?? 0) === status).length,
      ]),
    ),
    timing: Object.fromEntries(
      [
        'headersMs',
        'httpMs',
        'downloadMs',
        'parseMs',
        'validationMs',
        'persistMs',
        'elapsedMs',
      ].map((k) => [
        k,
        quantiles(records.filter((r) => typeof r[k] === 'number').map((r) => r[k])),
      ]),
    ),
    fullQueueSaveMs: quantiles(saves),
    offlineProcessMs: quantiles(processing),
    records,
  };
  mkdirSync('docs/evidence/national', { recursive: true });
  writeFileSync('docs/evidence/national/benchmark.json', JSON.stringify(report, null, 2));
  writeFileSync(resolve(directory, 'report.json'), JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      totals,
      statuses: report.statuses,
      save: report.fullQueueSaveMs,
      processing: report.offlineProcessMs,
    }),
  );
} finally {
  store.close();
  closeSync(fd);
  unlinkSync(lock);
}
