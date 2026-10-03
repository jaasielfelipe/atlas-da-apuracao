import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { Store } from '../db/store';
import { createApp } from '../app';
import { NationalCollection, LIVE_PROFILE } from './national';
import { rawDigest } from '../../../../packages/tse/src/index';

it('painel ao vivo: oficial isolado, mapa nacional, favoritos sincronizam o coletor', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'atlas-live-'));
  const path = join(folder, 'official.sqlite');
  const read = (p: string) => readFileSync(`packages/fixtures/${p}`, 'utf8');
  const observations = JSON.parse(read('zonal/observation.json'));
  const cat = observations.find((o: any) => o.file === 'official-ea12.json');
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
  // What bootstrapSources leaves behind in a real run.
  collection.collector.queue.add({
    key: 'bootstrap:ea12',
    url: cat.url,
    kind: 'tracking',
    priority: 100,
  });
  collection.collector.queue.suspend('bootstrap:ea12');
  collection.collector.save();
  store.db.prepare('INSERT INTO collector_body VALUES(?,?)').run(rawDigest(ea12), gzipSync(ea12));
  store.db
    .prepare('INSERT INTO collector_cache VALUES(?,?,?,?)')
    .run('bootstrap:ea12', rawDigest(ea12), cat.capturedAt, cat.capturedAt);
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
  });
  try {
    const boot = (await app.inject('/api/v1/live/official/bootstrap')).json();
    expect(boot.environment).toBe('official');
    expect(boot.capabilities.officialCollection).toBe(true);
    expect(boot.collectionRunning).toBe(false);
    expect(boot.captures).toEqual(['2026-10-03T00:06:00.000Z']);
    expect(boot.territories.filter((t: any) => t.kind === 'municipality').length).toBeGreaterThan(
      5000,
    );
    const latest = (await app.inject('/api/v1/live/official/latest?territory=br')).json();
    expect(latest.snapshot.environment).toBe('official');
    const map = (await app.inject('/api/v1/live/official/map?territory=br')).json();
    expect(map.length).toBeGreaterThanOrEqual(27); // UFs (+ exterior); BR itself is not a map row
    expect(map.every((r: any) => r.snapshot === null)).toBe(true); // zero ≠ absent: no UF captured
    expect(
      (await app.inject('/api/v1/live/official/latest?territory=br&office=governor')).statusCode,
    ).toBe(400);
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
    const key = (office: string) =>
      [...collection.collector.queue.jobs.values()].find(
        (j) =>
          j.kind === 'aggregate' && j.municipality === municipality.id && j.url.includes(office),
      );
    const president = key('-c0001-')!;
    expect(president.suspended).toBe(false);
    expect(president.due).toBeLessThanOrEqual(Date.now());
    await app.inject({
      method: 'DELETE',
      url: `/api/v1/live/official/watchlist/${encodeURIComponent(municipality.id)}`,
    });
    expect(collection.syncWatchlist()).toBe(true);
    expect(key('-c0001-')!.suspended).toBe(true);
  } finally {
    await app.close();
    store.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
