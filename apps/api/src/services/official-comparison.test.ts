import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../db/store';
import { createApp } from '../app';
import { NationalCollection } from './national';
import { persistHistory } from '../db/history';
import { acceptTerritorialAudit } from '../db/territorial';

it('acervo oficial isolado: replay, aceite, fonte parcial e agregado sem dependência histórica', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'atlas-official-'));
  const path = join(folder, 'official.sqlite'),
    historyPath = join(folder, 'history.sqlite');
  const store = new Store(path),
    history = new Store(historyPath);
  const read = (p: string) => readFileSync(`packages/fixtures/${p}`, 'utf8');
  const observations = JSON.parse(read('zonal/observation.json'));
  const cat = observations.find((o: any) => o.file === 'official-ea12.json');
  const zone = observations.find((o: any) => o.file === 'official-ac01120-z0008.json');
  const collection = new NationalCollection(
    store,
    'official',
    {
      raw: read('official/ea11.json'),
      url: 'https://resultados.tse.jus.br/oficial/comum/config/ele-c.json',
      capturedAt: cat.capturedAt,
    },
    { raw: read('zonal/official-ea12.json'), url: cat.url, capturedAt: cat.capturedAt },
  );
  const job = [...collection.collector.queue.jobs.values()].find((j) => j.url === zone.url)!;
  collection.accept(read('zonal/official-ac01120-z0008.json'), job, zone.capturedAt);
  const ids = [2018, 2022].map(
    (y) =>
      persistHistory(
        history,
        readFileSync(`packages/fixtures/history/${y}-ac.csv`),
        y as 2018 | 2022,
        `https://cdn.tse.jus.br/test-${y}.csv`,
        '2026-10-03T00:05:00.000Z',
      ).id,
  );
  acceptTerritorialAudit(history.db, collection.registry.segments, {
    id: 'test-acceptance',
    actor: 'user',
    statement: 'TESTE: aceite sintético',
    registryDigest: collection.registry.digest,
    import2018: ids[0],
    import2022: ids[1],
    capturedAt: '2026-10-03T01:00:00.000Z',
  });
  // Modified fixture is synthetic transport evidence, never an official observation.
  const raw = JSON.parse(read('simulado/ea20-president-br.json'));
  raw.f = 'o';
  raw.ele = '6257';
  const agg = [...collection.collector.queue.jobs.values()].find((j) =>
    j.url.endsWith('/br-c0001-e006257-u.json'),
  )!;
  collection.accept(JSON.stringify(raw), agg, '2026-10-03T00:06:00.000Z');
  store.close();
  history.close();
  const { app } = await createApp({
    dbPath: ':memory:',
    officialDbPath: path,
    historyDbPath: historyPath,
  });
  try {
    const c = await app.inject(
      '/api/v1/official/comparison?territory=ac&at=2026-10-03T01:01:00.000Z',
    );
    expect(c.statusCode).toBe(200);
    expect(c.json().comparison).toMatchObject({
      environment: 'official',
      coverage: { expected: 9, completed: 0, comparable: 0 },
    });
    expect(c.json().reconciliation.acceptedSegments).toBeGreaterThan(0);
    const before = (
      await app.inject('/api/v1/official/comparison?at=2026-10-03T00:30:00.000Z')
    ).json();
    expect(before.reconciliation.acceptedSegments).toBe(0);
    expect(
      (await app.inject('/api/v1/official/comparison?at=2026-10-02T00:00:00.000Z')).json()
        .comparison,
    ).toBeNull();
    expect((await app.inject('/api/v1/official/comparison?territory=xx')).statusCode).toBe(400);
    expect((await app.inject('/api/v1/official/results')).json().snapshots).toHaveLength(1);
    expect(
      (await app.inject('/api/v1/official/results?at=2026-10-03T00:05:00.000Z')).json().snapshots,
    ).toHaveLength(0);
    rmSync(historyPath);
    expect((await app.inject('/api/v1/official/comparison')).statusCode).toBe(503);
    expect((await app.inject('/api/v1/official/results')).json().snapshots).toHaveLength(1);
    expect((await app.inject('/api/v1/latest')).json().environment).toBe('fixture');
  } finally {
    await app.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
