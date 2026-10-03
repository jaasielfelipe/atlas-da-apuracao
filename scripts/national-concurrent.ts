import { readFileSync, writeFileSync, mkdirSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';
import { Store } from '../apps/api/src/db/store';
import { PersistentCollector } from '../apps/api/src/services/collector';
import { tseTransport } from '../packages/tse/src/http';
import {
  discoverElection,
  resolveTsePath,
  normalizeEA20,
  parseTracking,
} from '../packages/tse/src/index';
import { parseZoneRegistry, normalizeZone } from '../packages/tse/src/zones';
import { summarize } from '../packages/tse/src/national-model';
const maxInFlight = Number(process.env.BENCH_CONCURRENCY ?? 2),
  rps = Number(process.env.BENCH_RPS ?? 2);
if (![2, 3, 4].includes(maxInFlight) || ![2, 3, 5].includes(rps))
  throw Error('Experimento restrito a 2/3/5 req/s e 2/3/4 em voo');
mkdirSync('data/national-benchmark', { recursive: true });
const lock = 'data/national-benchmark/active.lock',
  fd = openSync(lock, 'wx');
const directory = `data/national-benchmark/concurrent-${Date.now()}`;
mkdirSync(directory, { recursive: true });
const store = new Store(`${directory}/benchmark.sqlite`);
const service = new PersistentCollector(store, Date.now, {
  intervalMs: 1000 / rps,
  maxInFlight,
  pollMs: 900000,
});
const validators = new Map<string, (raw: string) => boolean | undefined>();
const records: any[] = [];
let active = 0,
  peak = 0;
const stop = new AbortController();
const hardStop = setTimeout(() => stop.abort(), 120000);
const transport = tseTransport({
  validate: (raw, j) => {
    validators.get(j.key)!(raw);
  },
});
const measured = async (job: any, headers: Record<string, string>) => {
  const start = performance.now();
  active++;
  peak = Math.max(peak, active);
  try {
    const response = await transport(job, headers);
    const complete =
      response.raw && job.kind === 'zone' ? validators.get(job.key)!(response.raw) : undefined;
    records.push({
      key: job.key,
      kind: job.kind,
      url: job.url,
      startMs: start,
      elapsedMs: performance.now() - start,
      status: response.status,
      bytes: response.bytes,
      conditional: !!headers['If-None-Match'],
    });
    if (![200, 304].includes(response.status)) {
      stop.abort();
      throw Error(`Parada conservadora HTTP ${response.status}`);
    }
    if (job.key === 'ea11' || job.key === 'ea12' || job.requests >= 2)
      service.queue.jobs.get(job.key)!.suspended = true;
    else service.queue.hint(job.key, Date.now());
    return { ...response, complete };
  } catch (error) {
    stop.abort();
    throw error;
  } finally {
    active--;
  }
};
async function bootstrap(key: string, url: string, validate: (raw: string) => boolean | undefined) {
  validators.set(key, validate);
  service.queue.add({ key, url, kind: 'tracking', priority: 100 });
  while (!stop.signal.aborted) {
    const r = await service.tick(measured);
    if (r) {
      if (r.status !== 200) throw Error(`${key} não validado`);
      return JSON.parse(service.cached(key)!);
    }
    await sleep(25);
  }
  throw Error('Bootstrap interrompido');
}
try {
  const observation = JSON.parse(readFileSync('packages/fixtures/observation.json', 'utf8'));
  const config = await bootstrap(
    'ea11',
    observation.find((r: any) => r.file === 'simulado/ea11.json').url,
    (raw) => {
      discoverElection(JSON.parse(raw), 'simulated', 'president');
      return undefined;
    },
  );
  const context = discoverElection(config, 'simulated', 'president');
  const catalog = await bootstrap('ea12', resolveTsePath('EA12', context), (raw) => {
    parseZoneRegistry(JSON.parse(raw), 'simulated');
    return undefined;
  });
  const registry = parseZoneRegistry(catalog, 'simulated');
  function add(
    key: string,
    url: string,
    kind: 'zone' | 'aggregate' | 'tracking',
    validate: (raw: string) => boolean | undefined,
  ) {
    validators.set(key, validate);
    service.queue.add({ key, url, kind, priority: kind === 'tracking' ? 30 : 0 });
  }
  add('ea14', resolveTsePath('EA14', context), 'tracking', (raw) => {
    parseTracking(JSON.parse(raw), 'simulated', context.electionId, 'EA14');
    return undefined;
  });
  for (const uf of ['ac', 'ba', 'mg', 'sp', 'am']) {
    add(`ea15:${uf}`, resolveTsePath('EA15', { ...context, uf }), 'tracking', (raw) => {
      parseTracking(JSON.parse(raw), 'simulated', context.electionId, 'EA15');
      return undefined;
    });
    const list = catalog.abr.find((a: any) => a.cd === uf).mu;
    for (const m of [
      list.find((m: any) => m.z.length === 1),
      list.find((m: any) => m.z.length > 1),
    ].filter(Boolean)) {
      const c = { ...context, uf, municipality: m.cd, zone: m.z[0] },
        key = `${uf}:${m.cd}:${m.z[0]}`,
        url = resolveTsePath('EA20', c);
      add(
        key,
        url,
        'zone',
        (raw) =>
          normalizeZone(JSON.parse(raw), {
            ...c,
            sourceUrl: url,
            capturedAt: new Date().toISOString(),
            registry,
            raw,
          }).status === 'complete',
      );
    }
  }
  for (const uf of ['br', 'ac']) {
    const url = resolveTsePath('EA20', { ...context, uf });
    add(`aggregate:${uf}`, url, 'aggregate', (raw) => {
      const snapshot = normalizeEA20(JSON.parse(raw), {
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
      });
      store.insert(snapshot, raw);
      return undefined;
    });
  }
  const finished = setInterval(() => {
    if (service.queue.stats.requests >= 38 && service.queue.inFlight === 0) stop.abort();
  }, 50);
  try {
    await service.run(measured, stop.signal);
  } finally {
    clearInterval(finished);
  }
  const starts = records.map((r) => r.startMs).sort((a, b) => a - b);
  const report = {
    capturedAt: new Date().toISOString(),
    environment: 'simulated',
    rps,
    maxInFlight,
    peakInFlight: peak,
    nationalRegistrySegments: registry.segments.length,
    sampleRequests: records.length,
    stats: service.queue.stats,
    spacing: summarize(starts.slice(1).map((v, i) => v - starts[i])),
    latency: summarize(records.map((r) => r.elapsedMs)),
    aggregateSnapshots: store.db.prepare('SELECT COUNT(*) n FROM snapshot').get(),
    records,
  };
  writeFileSync(
    `docs/evidence/national/concurrent-${rps}rps-${maxInFlight}inflight.json`,
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify({ ...report, records: undefined }, null, 2));
  if (service.queue.stats.errors || records.length !== 38)
    throw Error('Amostra incompleta/com erros; consultar evidências');
} finally {
  clearTimeout(hardStop);
  store.close();
  closeSync(fd);
  unlinkSync(lock);
}
