import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../db/store';
import { createApp } from '../app';
import { NationalCollection, LIVE_PROFILE } from './national';
import { cacheBootstrapCatalog } from './test-helpers';
import { normalizeEA20 } from '../../../../packages/tse/src/index';

const read = (p: string) => readFileSync(`packages/fixtures/${p}`, 'utf8');

it('painel ao vivo oficial: isolado, mapa nacional, cobertura zonal e favoritos sincronizam o coletor', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'atlas-live-'));
  const path = join(folder, 'official.sqlite');
  const observations = JSON.parse(read('zonal/observation.json'));
  const cat = observations.find((o: any) => o.file === 'official-ea12.json');
  const zone = observations.find((o: any) => o.file === 'official-ac01120-z0008.json');
  const ea12 = read('zonal/official-ea12.json');
  const store = new Store(path);
  const collection = new NationalCollection(
    store,
    'official',
    {
      raw: read('official/ea11.json'),
      url: 'https://resultados.tse.jus.br/oficial/comum/config/ele-c.json',
      capturedAt: cat.capturedAt,
    },
    { raw: ea12, url: cat.url, capturedAt: cat.capturedAt },
    Date.now,
    LIVE_PROFILE,
  );
  cacheBootstrapCatalog(store, cat.url, ea12, cat.capturedAt);
  const zoneJob = [...collection.collector.queue.jobs.values()].find((j) => j.url === zone.url)!;
  collection.accept(read('zonal/official-ac01120-z0008.json'), zoneJob, zone.capturedAt);
  // Synthetic transport evidence (modified simulated body), never an official observation.
  const raw = JSON.parse(read('simulado/ea20-president-br.json'));
  raw.f = 'o';
  raw.ele = '6257';
  const agg = [...collection.collector.queue.jobs.values()].find((j) =>
    j.url.endsWith('/br-c0001-e006257-u.json'),
  )!;
  collection.accept(JSON.stringify(raw), agg, '2026-10-03T00:06:00.000Z');
  const { app } = await createApp({
    dbPath: ':memory:',
    officialDbPath: path,
    simulatedDbPath: join(folder, 'absent.sqlite'),
    historyDbPath: join(folder, 'absent-history.sqlite'),
  });
  try {
    const boot = (await app.inject('/api/v1/live/official/bootstrap')).json();
    expect(boot.environment).toBe('official');
    expect(boot.capabilities.officialCollection).toBe(true);
    expect(boot.collectionRunning).toBe(false);
    expect(boot.collection).toMatchObject({
      running: false,
      coverage: { expectedSegments: 6292, observedSegments: 1, completeZones: 0 },
    });
    expect(boot.captures).toEqual(['2026-10-03T00:06:00.000Z']);
    expect(boot.territories.filter((t: any) => t.kind === 'municipality').length).toBeGreaterThan(
      5000,
    );
    const status = (await app.inject('/api/v1/live/official/status')).json();
    expect(status).toMatchObject({
      environment: 'official',
      captures: 1,
      collection: { running: false, coverage: { expectedSegments: 6292, observedSegments: 1 } },
    });
    expect(status.territories).toBeUndefined(); // cheap poll: no catalog
    const latest = (await app.inject('/api/v1/live/official/latest?territory=br')).json();
    expect(latest.snapshot.environment).toBe('official');
    const map = (await app.inject('/api/v1/live/official/map?territory=br')).json();
    expect(map.length).toBeGreaterThanOrEqual(27); // UFs (+ exterior); BR itself is not a map row
    expect(map.every((r: any) => r.snapshot === null)).toBe(true); // zero ≠ absent: no UF captured
    expect(
      (await app.inject('/api/v1/live/official/latest?territory=br&office=governor')).statusCode,
    ).toBe(400);
    expect(
      (await app.inject('/api/v1/live/official/territories?q=rio%20branco')).json()[0].uf,
    ).toBe('ac');
    // History database absent: comparison unavailable, aggregates unaffected.
    expect((await app.inject('/api/v1/live/official/comparison')).statusCode).toBe(503);
    expect(
      (await app.inject('/api/v1/live/official/comparison?office=governor&territory=ac')).json()
        .cohort.status,
    ).toBe('out_of_scope');
    // Fixture and simulated routes never see official data.
    expect((await app.inject('/api/v1/latest')).json().environment).toBe('fixture');
    expect((await app.inject('/api/v1/live/simulated/bootstrap')).statusCode).toBe(503);

    const municipality = boot.territories.find(
      (t: any) => t.kind === 'municipality' && t.uf === 'ac',
    );
    const saved = await app.inject({
      method: 'POST',
      url: '/api/v1/live/official/watchlist',
      payload: { territoryId: municipality.id },
    });
    expect(saved.statusCode).toBe(200);
    expect(collection.syncWatchlist()).toBe(true);
    expect(collection.syncWatchlist()).toBe(false);
    const job = () =>
      [...collection.collector.queue.jobs.values()].find(
        (j) =>
          j.kind === 'aggregate' && j.municipality === municipality.id && j.url.includes('-c0001-'),
      )!;
    expect(job().suspended).toBe(false);
    expect(job().due).toBeLessThanOrEqual(Date.now());
    await app.inject({
      method: 'DELETE',
      url: `/api/v1/live/official/watchlist/${encodeURIComponent(municipality.id)}`,
    });
    expect(collection.syncWatchlist()).toBe(true);
    expect(job().suspended).toBe(true);
  } finally {
    await app.close();
    store.close();
    rmSync(folder, { recursive: true, force: true });
  }
});

it('painel ao vivo simulado: banco separado, corte temporal, sem comparação histórica', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'atlas-sim-'));
  const path = join(folder, 'sim.sqlite');
  const source = new Store(path);
  const raw = read('simulado/ea20-president-br.json');
  const capturedAt = '2026-10-03T18:00:00.000Z';
  const snapshot = normalizeEA20(JSON.parse(raw), {
    environment: 'simulated',
    electionId: '21270',
    office: 'president',
    territory: {
      id: 'br',
      kind: 'br',
      name: 'Brasil',
      uf: null,
      tseCode: null,
      ibgeCode: null,
      parentId: null,
    },
    sourceUrl:
      'https://resultados-sim.tse.jus.br/simulado/simulado2026/ele2026/21270/dados/br/br-c0001-e021270-u.json',
    capturedAt,
    raw,
  });
  source.insert(snapshot, raw);
  cacheBootstrapCatalog(
    source,
    'https://resultados-sim.tse.jus.br/simulado/simulado2026/ele2026/21270/config/br/br-e021270-i.json',
    read('simulado/ea12.json'),
    capturedAt,
  );
  source.close();
  const { app, store } = await createApp({ dbPath: ':memory:', simulatedDbPath: path });
  try {
    expect(
      (await app.inject('/api/v1/live/simulated/snapshots?territory=br'))
        .json()
        .map((s: any) => s.id),
    ).toEqual([snapshot.id]);
    expect(
      (
        await app.inject(
          '/api/v1/live/simulated/snapshots?territory=br&at=2026-10-03T17:59:59.000Z',
        )
      ).json(),
    ).toEqual([]);
    expect(
      (await app.inject('/api/v1/live/simulated/latest?office=governor&territory=br')).statusCode,
    ).toBe(400);
    const boot = (await app.inject('/api/v1/live/simulated/bootstrap')).json();
    expect(boot).toMatchObject({
      environment: 'simulated',
      capabilities: { officialCollection: false, cohort: false },
      collection: { running: false, coverage: null },
    });
    const comparison = (await app.inject('/api/v1/live/simulated/comparison')).json();
    expect(comparison).toMatchObject({ status: 'unavailable', comparison: null });
    expect(store.latest('simulated', 'president', 'br')).toBeNull();
    expect((await app.inject('/api/v1/latest')).json().environment).toBe('fixture');
  } finally {
    await app.close();
    rmSync(folder, { recursive: true, force: true });
  }
});

it('acervo ausente retorna indisponível sem criar banco', async () => {
  const missing = join(tmpdir(), `missing-atlas-${Date.now()}.sqlite`);
  const { app } = await createApp({ dbPath: ':memory:', simulatedDbPath: missing });
  try {
    expect((await app.inject('/api/v1/live/simulated/bootstrap')).statusCode).toBe(503);
    expect((await app.inject('/api/v1/live/simulated/map')).statusCode).toBe(503);
  } finally {
    await app.close();
  }
});
