import { expect, it } from 'vitest';
import { Store } from './store';
import {
  acceptTerritorialAudit,
  attachAcceptedHistory,
  type TerritorialApproval,
} from './territorial';
import { zoneFixture, zoneCaptures } from '../../../../packages/domain/src/zone-fixture';
import { compareZones, validResult } from '../../../../packages/domain/src/zones';

it('aceite explícito é imutável, idempotente, temporal e limitado às ZEs compatíveis', () => {
  const store = new Store(':memory:');
  try {
    const d = zoneFixture(4);
    d.environment = 'official';
    const historical = d.results.filter((r) => r.year !== 2026);
    d.results = d.results
      .filter((r) => r.year === 2026)
      .map((r) => ({ ...r, environment: 'official' }));
    d.matches = [];
    for (const year of [2018, 2022]) {
      store.db
        .prepare('INSERT INTO historical_import VALUES(?,?,?,?,?,?,?,?,?)')
        .run(
          String(year),
          year,
          `fixture-${year}`,
          zoneCaptures[0],
          'https://cdn.tse.jus.br/test.csv',
          String(year),
          'windows-1252',
          1,
          'pending_reconciliation',
        );
      for (const r of historical.filter((r) => r.year === year)) {
        store.db
          .prepare('INSERT INTO historical_segment VALUES(?,?,?,?,?)')
          .run(String(year), r.uf, r.municipality, r.zone, r.valid);
        for (const c of r.candidates)
          store.db
            .prepare('INSERT INTO historical_vote VALUES(?,?,?,?,?,?,?,?)')
            .run(String(year), r.uf, r.municipality, r.zone, c.id, '00', 'synthetic', c.votes);
      }
    }
    const approval: TerritorialApproval = {
      id: 'decision-test',
      actor: 'user',
      capturedAt: zoneCaptures[4],
      registryDigest: d.registryDigest,
      import2018: '2018',
      import2022: '2022',
      statement: 'Aceite sintético de teste',
    };
    const accepted = acceptTerritorialAudit(store.db, d.segments, approval);
    expect(accepted.acceptedZones).toBe(3);
    expect(acceptTerritorialAudit(store.db, d.segments, approval)).toEqual(accepted);
    expect(() =>
      acceptTerritorialAudit(store.db, d.segments, { ...approval, statement: 'alterado' }),
    ).toThrow('imutável');
    const attached = attachAcceptedHistory(store.db, d, zoneCaptures[4]);
    expect(attached.matches.every((m) => m.method === 'user_accepted_structural')).toBe(true);
    expect(
      attached.results
        .filter((r) => r.year !== 2026)
        .every((r) => r.total === null && validResult(r)),
    ).toBe(true);
    expect(compareZones(attached, zoneCaptures[4]).coverage.comparable).toBe(3);
    expect(compareZones(attached, zoneCaptures[3]).coverage.comparable).toBe(0);
    expect(attachAcceptedHistory(store.db, d, zoneCaptures[3]).matches).toHaveLength(0);
    expect(
      attachAcceptedHistory(store.db, { ...d, registryDigest: 'changed' }, zoneCaptures[4]).matches,
    ).toHaveLength(0);
    expect(() =>
      attachAcceptedHistory(store.db, { ...d, environment: 'simulated' }, zoneCaptures[4]),
    ).toThrow('oficial');
    expect(() =>
      attachAcceptedHistory(store.db, { ...d, segments: d.segments.slice(1) }, zoneCaptures[4]),
    ).toThrow('incompatível');
    const missing = structuredClone(attached);
    delete (missing.mappings as Partial<typeof missing.mappings>)[2026];
    expect(compareZones(missing, zoneCaptures[4]).coverage.comparable).toBe(0);
    expect(
      validResult({
        ...attached.results[0],
        basis: 'historical_final',
        total: null,
        totalized: null,
        notTotalized: null,
      }),
    ).toBe(false);
    expect(store.db.prepare('SELECT count(*) AS n FROM territorial_audit').get()).toEqual({ n: 3 });
  } finally {
    store.close();
  }
});

it('divergências, ausências e exterior não recebem aceite; transação não apaga provas anteriores', () => {
  const store = new Store(':memory:');
  try {
    const s = { uf: 'ac', municipality: '00001', zone: '0001' };
    for (const year of [2018, 2022]) {
      store.db
        .prepare('INSERT INTO historical_import VALUES(?,?,?,?,?,?,?,?,?)')
        .run(
          String(year),
          year,
          '1',
          '2026-10-01T00:00:00.000Z',
          'https://cdn.tse.jus.br/test',
          String(year),
          'windows-1252',
          1,
          'pending_reconciliation',
        );
      for (const uf of ['ac', 'zz'])
        store.db
          .prepare('INSERT INTO historical_segment VALUES(?,?,?,?,?)')
          .run(String(year), uf, s.municipality, s.zone, 1);
    }
    const current = [s, { ...s, municipality: '00002' }, { ...s, uf: 'zz' }, { ...s, uf: 'ap' }];
    expect(
      acceptTerritorialAudit(store.db, current, {
        id: 'test',
        actor: 'user',
        capturedAt: '2026-10-03T00:00:00.000Z',
        registryDigest: 'test',
        import2018: '2018',
        import2022: '2022',
        statement: 'Teste',
      }),
    ).toMatchObject({ acceptedZones: 0, acceptedSegments: 0, excludedZones: 3 });
  } finally {
    store.close();
  }
});
