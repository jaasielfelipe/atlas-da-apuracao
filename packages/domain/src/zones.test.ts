import { describe, expect, it } from 'vitest';
import { compareZones, leader, classes, years, validResult, segmentId } from './zones';
import { zoneFixture, zoneCaptures } from './zone-fixture';

describe('coorte de zonas completas — evidência sintética', () => {
  it('dez unidades: 6/4 com fluxos 2 e 1 produz 5/5; não exige fluxos iguais', () => {
    const d = zoneFixture(0),
      base = d.results[0];
    d.segments = [];
    d.results = [];
    d.matches = [];
    for (let i = 0; i < 10; i++) {
      const s = { uf: 'ac', municipality: '01120', zone: String(i + 1).padStart(4, '0') },
        key = segmentId(s);
      d.segments.push(s);
      d.matches.push({
        id: key,
        current: key,
        historical2018: key,
        historical2022: key,
        status: 'verified',
        capturedAt: zoneCaptures[0],
        method: 'synthetic',
        evidence: 'test',
        registryDigest: d.registryDigest,
      });
      for (const year of years) {
        const b = year === 2026 ? (i < 6 ? i >= 2 : i === 6) : i < 6;
        d.results.push({
          ...base,
          ...s,
          id: `${year}:${key}`,
          year,
          election: `fixture-${year}`,
          status: 'complete',
          total: 10,
          totalized: 10,
          notTotalized: 0,
          valid: 100,
          candidates: [
            { id: d.mappings[year].bolsonaro, votes: b ? 60 : 40 },
            { id: d.mappings[year].lula_haddad, votes: b ? 40 : 60 },
          ],
        });
      }
    }
    const c = compareZones(d, zoneCaptures[0]);
    expect(c.leadership[2018]).toMatchObject({ bolsonaro: 6, lula_haddad: 4 });
    expect(c.leadership[2026]).toMatchObject({ bolsonaro: 5, lula_haddad: 5 });
    expect(c.transitions[2018]).toMatchObject({
      bolsonaroToLula: 2,
      lulaToBolsonaro: 1,
      net: { bolsonaro: -1, lula_haddad: 1, outros: 0, empate: 0 },
    });
  });
  it('aguarda todos os segmentos; município conta unidades município–zona', () => {
    const d = zoneFixture();
    expect(compareZones(d, zoneCaptures[0]).coverage).toEqual({
      expected: 3,
      completed: 0,
      comparable: 0,
    });
    expect(
      compareZones(d, zoneCaptures[0], { uf: 'ac', municipality: '01120' }).coverage.comparable,
    ).toBe(1);
    expect(compareZones(d, zoneCaptures[1]).coverage.comparable).toBe(1);
    expect(compareZones(d, zoneCaptures[2]).coverage.comparable).toBe(3);
  });
  it('retificação retira a zona e replay não conhece informação futura', () => {
    const d = zoneFixture();
    expect(
      [0, 1, 2, 3, 4].map((i) => compareZones(d, zoneCaptures[i]).coverage.comparable),
    ).toEqual([0, 1, 3, 2, 3]);
    expect(compareZones(d, zoneCaptures[1])).toEqual(compareZones(zoneFixture(1), zoneCaptures[1]));
    expect(compareZones(d, '2026-10-02T16:00:00.000Z').coverage.expected).toBeNull();
  });
  it('considera terceiros, empates e ausência de denominador', () => {
    const mapping = { bolsonaro: 'b', lula_haddad: 'l' };
    expect(
      leader(
        [
          { id: 'b', votes: 30 },
          { id: 'l', votes: 20 },
          { id: 'o', votes: 40 },
        ],
        mapping,
      ),
    ).toBe('outros');
    expect(
      leader(
        [
          { id: 'b', votes: 30 },
          { id: 'l', votes: 30 },
        ],
        mapping,
      ),
    ).toBe('empate');
    expect(
      leader(
        [
          { id: 'b', votes: 0 },
          { id: 'l', votes: 0 },
        ],
        mapping,
      ),
    ).toBeNull();
    const d = zoneFixture();
    d.results.forEach((r) => {
      if (r.year === 2018) r.valid = 0;
    });
    expect(compareZones(d, zoneCaptures[4]).coverage.comparable).toBe(0);
  });
  it('mesma coorte nos três anos; médias ponderadas e invariantes das matrizes', () => {
    const c = compareZones(zoneFixture(), zoneCaptures[4]);
    expect(c.shares[2026].bolsonaro).toBeCloseTo((600 * 0.3 + 1500 * 0.4) / 2100);
    for (const year of years)
      expect(Object.values(c.leadership[year]).reduce((a, b) => a + b, 0)).toBe(3);
    for (const year of [2018, 2022] as const) {
      const t = c.transitions[year];
      expect(t.matrix.flat().reduce((a, b) => a + b, 0)).toBe(3);
      expect(Object.values(t.net).reduce((a, b) => a + b, 0)).toBe(0);
      classes.forEach((cl, i) =>
        expect(t.net[cl]).toBe(c.leadership[2026][cl] - c.leadership[year][cl]),
      );
    }
    expect(c.transitions[2018].bolsonaroToLula).toBe(1);
    expect(c.transitions[2018].lulaToBolsonaro).toBe(0);
    expect(c.leadership[2022].outros).toBe(3);
    expect(c.leadership[2026].empate).toBe(2);
  });
  it('conciliação desconhecida/duplicada/revogação afeta a coorte inteira', () => {
    const d = zoneFixture();
    d.matches[0].status = 'uncertain';
    expect(compareZones(d, zoneCaptures[4]).coverage.comparable).toBe(2);
    d.matches[0].status = 'verified';
    d.matches[0].historical2018 = d.matches[3].historical2018;
    expect(compareZones(d, zoneCaptures[4]).coverage.comparable).toBe(1);
    const e = zoneFixture();
    e.matches.push({
      ...e.matches[0],
      id: 'revoke',
      status: 'review',
      capturedAt: zoneCaptures[3],
    });
    expect(compareZones(e, zoneCaptures[2]).coverage.comparable).toBe(3);
    expect(compareZones(e, zoneCaptures[4]).coverage.comparable).toBe(2);
  });
  it('rejeita duplicação cadastral, votos inconsistentes e ambientes misturados', () => {
    const d = zoneFixture();
    d.segments.push(d.segments[0]);
    expect(() => compareZones(d, zoneCaptures[4])).toThrow('duplicado');
    const e = zoneFixture();
    e.results.forEach((r) => {
      if (r.year === 2018) r.environment = 'official';
    });
    expect(compareZones(e, zoneCaptures[4]).coverage.comparable).toBe(0);
    expect(validResult({ ...zoneFixture().results[0], total: 0 })).toBe(false);
    expect(validResult({ ...zoneFixture().results[0], candidates: [] })).toBe(false);
  });
});
