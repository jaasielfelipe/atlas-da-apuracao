import { expect, it } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { Store } from './store';
import { ZoneStore } from './zones';
import { persistHistory } from './history';
import { zoneFixture, zoneCaptures } from '../../../../packages/domain/src/zone-fixture';
import { compareZones } from '../../../../packages/domain/src/zones';
import { PersistentCollector } from '../services/collector';
it('migra v1 com dados preservados, deduplica e reinicia acervo zonal e cache', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'atlas-zone-')),
    path = join(directory, 'atlas.sqlite');
  let store: Store | undefined;
  try {
    const old = new Database(path);
    old.exec(readFileSync('apps/api/src/db/migrations/001_initial.sql', 'utf8'));
    old.pragma('user_version=1');
    old.prepare('INSERT INTO app_state VALUES(?,?)').run('preserved', 'yes');
    old.close();
    store = new Store(path);
    expect(store.getState('preserved')).toBe('yes');
    const zones = new ZoneStore(store);
    zones.insertFixture(zoneFixture());
    zones.insertFixture(zoneFixture());
    const n = store.db.prepare('SELECT COUNT(*) n FROM zone_result').get();
    const c = compareZones(zones.load('fixture', zoneCaptures[4])!, zoneCaptures[4]);
    expect(c.coverage.comparable).toBe(3);
    expect(zones.load('official', zoneCaptures[4])).toBeNull();
    const collector = new PersistentCollector(store, () => 1000000);
    collector.queue.add({ key: 'a', url: 'fixture:a', kind: 'zone', priority: 0 });
    await collector.tick(async () => ({ status: 200, bytes: 2, raw: '{}', etag: 'proof' }));
    store.close();
    store = new Store(path);
    const restarted = new PersistentCollector(store, () => 1000000);
    expect(restarted.cached('a')).toBe('{}');
    expect(restarted.queue.jobs.get('a')?.etag).toBe('proof');
    expect(restarted.queue.stats.requests).toBe(1);
    expect(store.db.prepare('SELECT COUNT(*) n FROM zone_result').get()).toEqual(n);
    expect(
      compareZones(new ZoneStore(store).load('fixture', zoneCaptures[4])!, zoneCaptures[4]),
    ).toEqual(c);
  } finally {
    store?.close();
    const target = resolve(directory);
    if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('atlas-zone-'))
      throw Error('Limpeza recusada');
    rmSync(target, { recursive: true, force: true });
  }
});
it('histórico normalizado, imutável, idempotente e sem certificação automática', () => {
  const store = new Store(':memory:');
  try {
    const bytes = readFileSync('packages/fixtures/history/2018-ac.csv'),
      source =
        'https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_2018.zip';
    const result = persistHistory(store, bytes, 2018, source, '2026-10-03T00:00:00.000Z');
    persistHistory(store, bytes, 2018, source, '2026-10-03T00:00:00.000Z');
    expect(result.status).toBe('pending_reconciliation');
    expect(store.db.prepare('SELECT COUNT(*) n FROM historical_segment').get()).toEqual({ n: 23 });
    expect(store.db.prepare('SELECT COUNT(*) n FROM historical_vote').get()).toEqual({ n: 299 });
    expect(() => store.db.exec('UPDATE historical_vote SET votes=0')).toThrow('imutável');
    expect(store.db.prepare('SELECT COUNT(*) n FROM zone_match').get()).toEqual({ n: 0 });
  } finally {
    store.close();
  }
});
