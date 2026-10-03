import { mkdirSync, openSync, closeSync, unlinkSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { Store } from '../apps/api/src/db/store';
import { PersistentCollector } from '../apps/api/src/services/collector';
import { NationalCollection } from '../apps/api/src/services/national';
import { tseTransport } from '../packages/tse/src/http';
import { discoverElection, resolveTsePath } from '../packages/tse/src/index';
import { parseZoneRegistry } from '../packages/tse/src/zones';

export async function runCollection(environment: 'official' | 'simulated') {
  const seconds = Number(process.env.COLLECT_SECONDS ?? 60);
  if (!Number.isFinite(seconds) || seconds < 10 || seconds > 180)
    throw Error('COLLECT_SECONDS: 10 a 180; ensaio limitado, coleta limitada');
  mkdirSync('data/national-benchmark', { recursive: true });
  const lock = 'data/national-benchmark/active.lock',
    fd = openSync(lock, 'wx');
  const store = new Store(`data/${environment}/collection.sqlite`);
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), seconds * 1000);
  process.once('SIGINT', () => stop.abort());
  try {
    const bootstrap = new PersistentCollector(store);
    async function capture(key: string, url: string, validate: (raw: string) => void) {
      bootstrap.queue.add({ key, url, kind: 'tracking', priority: 100 });
      const job = bootstrap.queue.jobs.get(key)!;
      bootstrap.queue.suspend(key, false);
      bootstrap.queue.hint(key, Date.now());
      const transport = tseTransport({
        validate: (raw, j) => {
          if (j.key !== key) throw Error('Bootstrap inesperado');
          validate(raw);
        },
      });
      while (!stop.signal.aborted) {
        const result = await bootstrap.tick(
          async (j, h) => {
            const response = await transport(j, h);
            job.suspended = true;
            if (![200, 304].includes(response.status)) stop.abort();
            return response;
          },
          undefined,
          (j) => j.key === key,
        );
        if (result) {
          if (![200, 304].includes(result.status)) throw Error('Bootstrap indisponível');
          const saved = store.db
            .prepare('SELECT captured_at FROM collector_cache WHERE job_key=?')
            .get(key) as { captured_at: string };
          return { url, raw: bootstrap.cached(key)!, capturedAt: saved.captured_at };
        }
        await sleep(25);
      }
      throw Error('Ensaio interrompido no bootstrap');
    }
    const config = await capture(
      'bootstrap:ea11',
      environment === 'official'
        ? 'https://resultados.tse.jus.br/oficial/comum/config/ele-c.json'
        : 'https://resultados-sim.tse.jus.br/simulado/simulado2026/comum/config/ele-c.json',
      (raw) => {
        discoverElection(JSON.parse(raw), environment, 'president');
      },
    );
    const context = discoverElection(JSON.parse(config.raw), environment, 'president');
    const catalog = await capture('bootstrap:ea12', resolveTsePath('EA12', context), (raw) => {
      parseZoneRegistry(JSON.parse(raw), environment);
    });
    const collection = new NationalCollection(store, environment, config, catalog);
    const transport = collection.transport();
    await collection.collector.run(
      async (job, headers) => {
        try {
          const response = await transport(job, headers);
          if (![200, 304].includes(response.status)) stop.abort();
          return response;
        } catch (error) {
          stop.abort();
          throw error;
        }
      },
      stop.signal,
      (raw, job, at) => {
        try {
          collection.accept(raw, job, at);
        } catch (error) {
          stop.abort();
          throw error;
        }
      },
    );
    const report = {
      capturedAt: new Date().toISOString(),
      secondsRequested: seconds,
      ...collection.status(),
      aggregateSnapshots: store.db.prepare('SELECT COUNT(*) n FROM snapshot').get(),
      observations: store.db
        .prepare('SELECT status,COUNT(*) n FROM collector_observation GROUP BY status')
        .all(),
      normalizedZones: store.db
        .prepare(
          'SELECT uf,municipality,zone,captured_at,source_url,source_digest,status,total,totalized,not_totalized,valid FROM zone_result ORDER BY captured_at',
        )
        .all(),
    };
    writeFileSync(
      `docs/evidence/national/ingestion-${environment}.json`,
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    clearTimeout(timer);
    store.close();
    closeSync(fd);
    unlinkSync(lock);
  }
}
