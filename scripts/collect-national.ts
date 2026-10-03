import { writeFileSync } from 'node:fs';
import { Store } from '../apps/api/src/db/store';
import { NationalCollection } from '../apps/api/src/services/national';
import { acquireIpLock, bootstrapSources, type Environment } from './collect-bootstrap';

/** Bounded rehearsal (10–180 s) under the conservative profile; stops on the first non-200/304. */
export async function runCollection(environment: Environment) {
  const seconds = Number(process.env.COLLECT_SECONDS ?? 60);
  if (!Number.isFinite(seconds) || seconds < 10 || seconds > 180)
    throw Error('COLLECT_SECONDS: 10 a 180; ensaio limitado, coleta limitada');
  const release = acquireIpLock(`rehearsal:${environment}`);
  const store = new Store(`data/${environment}/collection.sqlite`);
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), seconds * 1000);
  process.once('SIGINT', () => stop.abort());
  try {
    const { config, catalog } = await bootstrapSources(store, environment, stop.signal);
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
    release();
  }
}
