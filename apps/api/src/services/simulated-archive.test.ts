import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../db/store';
import { createApp } from '../app';
import { normalizeEA20 } from '../../../../packages/tse/src/index';
it('API de acervo lê simulado separado sem contaminar fixture e respeita corte temporal', async () => {
  const folder = mkdtempSync(join(tmpdir(), 'atlas-sim-'));
  const path = join(folder, 'sim.sqlite');
  const source = new Store(path);
  const raw = readFileSync('packages/fixtures/simulado/ea20-president-br.json', 'utf8');
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
  source.close();
  const { app, store } = await createApp({ dbPath: ':memory:', simulatedDbPath: path });
  try {
    const r = await app.inject('/api/v1/simulated/results');
    expect(r.statusCode).toBe(200);
    expect(r.json()).toMatchObject({
      environment: 'simulated',
      historicalComparison: 'pending_validation',
      snapshots: [{ id: snapshot.id }],
    });
    expect(
      (await app.inject('/api/v1/simulated/results?at=2026-10-03T17:59:59.000Z')).json().snapshots,
    ).toEqual([]);
    expect(
      (await app.inject('/api/v1/simulated/results?office=governor&territory=br')).statusCode,
    ).toBe(400);
    expect(store.latest('simulated', 'president', 'br')).toBeNull();
    expect((await app.inject('/api/v1/latest')).json().environment).toBe('fixture');
    expect((await app.inject('/api/v1/simulated/archive')).json().coverage).toBeNull();
  } finally {
    await app.close();
    rmSync(folder, { recursive: true, force: true });
  }
});
it('acervo ausente retorna indisponível sem criar banco', async () => {
  const { app } = await createApp({
    dbPath: ':memory:',
    simulatedDbPath: join(tmpdir(), `missing-atlas-${Date.now()}.sqlite`),
  });
  try {
    expect((await app.inject('/api/v1/simulated/archive')).statusCode).toBe(503);
  } finally {
    await app.close();
  }
});
