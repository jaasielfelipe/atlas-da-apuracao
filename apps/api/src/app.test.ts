import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { createApp } from './app';
import { normalizeEA20 } from '../../../packages/tse/src/index';
import type { Snapshot } from '../../../packages/domain/src/index';
const cleanup: (() => Promise<void> | void)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
async function setup(path = ':memory:') {
  const service = await createApp({ dbPath: path });
  cleanup.push(() => service.app.close());
  return service;
}
describe('Etapa 1: SQLite e API local em fixture', () => {
  it('inicia isolado, com 3 capturas e sem municípios coletados silenciosamente', async () => {
    const { app, store } = await setup();
    expect((await app.inject('/health')).json()).toMatchObject({
      ok: true,
      environment: 'fixture',
    });
    expect((await app.inject('/api/v1/bootstrap')).json().captures).toHaveLength(3);
    expect(store.latest('official', 'president', 'br')).toBeNull();
    expect(store.latest('simulated', 'president', 'br')).toBeNull();
    const response = (await app.inject('/api/v1/latest?territory=ac%3A01120')).json();
    expect(response).toMatchObject({ snapshot: null, status: 'not_monitored' });
    await app.inject('/api/v1/territories?q=Acrelandia');
    expect(store.latest('fixture', 'president', 'ac:01120')).toBeNull();
    expect((await app.inject('/api/v1/latest?office=governor')).statusCode).toBe(400);
    expect((await app.inject('/api/v1/latest?at=not-a-date')).statusCode).toBe(400);
  });
  it('salvar inicia no instante atual; remover mantém histórico e interrompe ingestão', async () => {
    const { app, store } = await setup();
    await app.inject({
      method: 'POST',
      url: '/api/v1/watchlist',
      payload: { territoryId: 'ac:01120' },
    });
    expect(store.snapshots('fixture', 'president', 'ac:01120')).toHaveLength(1);
    expect(store.latest('fixture', 'president', 'ac:01120', '2026-10-02T17:10:00.000Z')).toBeNull();
    await app.inject({ method: 'POST', url: '/api/v1/fixture/advance' });
    expect(store.snapshots('fixture', 'president', 'ac:01120')).toHaveLength(2);
    await app.inject({ method: 'DELETE', url: '/api/v1/watchlist/ac%3A01120' });
    await app.inject({ method: 'POST', url: '/api/v1/fixture/advance' });
    expect(store.snapshots('fixture', 'president', 'ac:01120')).toHaveLength(2);
    expect(store.watchlist('fixture')[0].enabled).toBe(false);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/watchlist',
          payload: { territoryId: 'br' },
        })
      ).statusCode,
    ).toBe(400);
  });
  it('timeline usa corte por captura e map/latest compartilham instante sem escrita', async () => {
    const { app, store } = await setup();
    const before = store.db.prepare('SELECT COUNT(*) n FROM snapshot').get();
    const at = '2026-10-02T17:15:00.000Z';
    const latest = (await app.inject(`/api/v1/latest?territory=ac&at=${at}`)).json().snapshot;
    expect(latest.capturedAt).toBe('2026-10-02T17:10:00.000Z');
    const map = (await app.inject(`/api/v1/map?at=${at}`)).json();
    expect(map.find((t: { territoryId: string }) => t.territoryId === 'ac').snapshot.id).toBe(
      latest.id,
    );
    expect(store.db.prepare('SELECT COUNT(*) n FROM snapshot').get()).toEqual(before);
    const unavailable = (await app.inject('/api/v1/comparison')).json();
    expect(unavailable.candidateStatus).toBe('synthetic_mapping');
    expect(unavailable.officialStatus).toBe('pending_validation');
  });
  it('comparação zonal sintética distingue ZE de segmento e não habilita o oficial', async () => {
    const { app, store } = await setup();
    const snapshotsBefore = store.db.prepare('SELECT COUNT(*) n FROM snapshot').get();
    for (const [territory, unitKind] of [
      ['br', 'whole_zone'],
      ['ac', 'whole_zone'],
      ['ac:01120', 'municipality_zone'],
    ]) {
      const response = await app.inject(`/api/v1/comparison?territory=${territory}`);
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        environment: 'fixture',
        status: 'ready',
        basis: 'historical_zone_cohort',
        unitKind,
        candidateStatus: 'synthetic_mapping',
        cohort: { enabled: true, status: 'fixture_only' },
        officialStatus: 'pending_validation',
      });
      expect(response.json().comparison.coverage.comparable).toBe(territory === 'ac:01120' ? 1 : 3);
      expect(response.json().comparison.transitions[2018].matrix).toHaveLength(4);
    }
    expect(store.db.prepare('SELECT COUNT(*) n FROM snapshot').get()).toEqual(snapshotsBefore);
    expect(store.watchlist('fixture')).toEqual([]);
    const governor = (await app.inject('/api/v1/comparison?office=governor&territory=ac')).json();
    expect(governor.cohort).toMatchObject({ enabled: false, status: 'out_of_scope' });
  });
  it('coorte persiste normalizada; correção e replay recalculam sem escrita', async () => {
    const { app, store } = await setup();
    const old = (await app.inject('/api/v1/comparison?at=2026-10-02T17:10:00.000Z')).json();
    expect(old.comparison.coverage.comparable).toBe(1);
    expect(old.timeline).toHaveLength(2);
    const before = store.db.prepare('SELECT COUNT(*) n FROM zone_result').get();
    await app.inject('/api/v1/comparison');
    expect(store.db.prepare('SELECT COUNT(*) n FROM zone_result').get()).toEqual(before);
    await app.inject({ method: 'POST', url: '/api/v1/fixture/advance' });
    expect((await app.inject('/api/v1/comparison')).json().comparison.coverage.comparable).toBe(2);
    expect((await app.inject('/api/v1/comparison?at=2026-10-02T17:10:00.000Z')).json()).toEqual(
      old,
    );
    expect(() => store.db.exec('UPDATE zone_result SET valid=0')).toThrow('imutáveis');
    expect(() => store.db.exec('DELETE FROM zone_candidate_vote')).toThrow('imutáveis');
    expect(store.db.pragma('user_version', { simple: true })).toBe(4);
  });
  it('WAL persiste snapshots, favoritos e cursor após reinício sem duplicação', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'atlas-test-'));
    cleanup.push(() => {
      const target = resolve(directory);
      if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('atlas-test-')) {
        throw Error('Recusa de limpeza fora do diretório temporário do teste');
      }
      rmSync(target, { recursive: true, force: true });
    });
    const dbPath = join(directory, 'atlas.sqlite');
    const first = await createApp({ dbPath });
    expect(first.store.db.pragma('journal_mode', { simple: true })).toBe('wal');
    await first.app.inject({
      method: 'POST',
      url: '/api/v1/watchlist',
      payload: { territoryId: 'ac:01120' },
    });
    const count = first.store.db.prepare('SELECT COUNT(*) n FROM snapshot').get();
    await first.app.close();
    const second = await setup(dbPath);
    expect(second.store.db.prepare('SELECT COUNT(*) n FROM snapshot').get()).toEqual(count);
    expect(second.store.watchlist('fixture')[0]).toMatchObject({
      territoryId: 'ac:01120',
      enabled: true,
    });
    expect(second.fixtures.step).toBe(2);
  });
  it('snapshots e brutos imutáveis, digest deduplica e revisão não apaga anterior', async () => {
    const { store, fixtures } = await setup();
    const old = store.latest('fixture', 'president', 'br')!;
    expect(store.insert(old, store.raw(old.rawDigest)!)).toBe(false);
    expect(() =>
      store.db.prepare('UPDATE snapshot SET source_idg=? WHERE id=?').run('new', old.id),
    ).toThrow(/imutáveis/);
    expect(() => store.db.prepare('DELETE FROM snapshot WHERE id=?').run(old.id)).toThrow(
      /imutáveis/,
    );
    const input = fixtures.raw(fixtures.territories[0], 'president', 1);
    input.idg = '2';
    const raw = JSON.stringify(input);
    const revised = normalizeEA20(input, {
      environment: 'fixture',
      office: 'president',
      electionId: '21270',
      territory: fixtures.territories[0],
      sourceUrl: 'fixture:revision',
      capturedAt: '2026-10-02T18:00:00.000Z',
      raw,
    });
    expect(store.insert(revised, raw)).toBe(true);
    expect(store.latest('fixture', 'president', 'br')!.votes.valid).toBeLessThan(old.votes.valid!);
    expect(store.byId('fixture', old.id)).toEqual(old);
    expect(() =>
      store.insert({ ...old, environment: 'official' } as Snapshot, store.raw(old.rawDigest)!),
    ).toThrow(/Fase/);
  });
  it('modo oficial falha fechado e bloqueia mutações de origem externa', async () => {
    await expect(createApp({ environment: 'official', dbPath: ':memory:' })).rejects.toThrow(
      /ainda não habilitada/,
    );
    const { app } = await setup();
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/fixture/advance',
          headers: { origin: 'https://external.test' },
        })
      ).statusCode,
    ).toBe(403);
  });
});
