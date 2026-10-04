import { describe, expect, it } from 'vitest';
import { TRACK, along, path, point } from './geometry';
import { bulletins, increment, leaders, pace, raceState, TRACK_SHARE } from './race';
import type { Snapshot } from '../../../../packages/domain/src/index';

describe('pista serpentina', () => {
  it('votos iguais ficam lado a lado em qualquer ponto, inclusive nas curvas', () => {
    for (let u = 0; u <= TRACK.CL; u += 37) {
      const a = point(u, -8),
        b = point(u, 8),
        c = point(u, 0);
      // Both lanes sit at the same centre-line point, 8 px to each side.
      expect(Math.hypot(a.x - c.x, a.y - c.y)).toBeCloseTo(8, 5);
      expect(Math.hypot(b.x - c.x, b.y - c.y)).toBeCloseTo(8, 5);
      expect((a.x + b.x) / 2).toBeCloseTo(c.x, 5);
      expect((a.y + b.y) / 2).toBeCloseTo(c.y, 5);
    }
  });
  it('sem recursão nem travamento em 0, no fim e acima do fim (resíduo de ponto flutuante)', () => {
    expect(point(0, 0)).toMatchObject({ x: TRACK.X0, y: TRACK.Y0 });
    const end = point(TRACK.CL, 0);
    expect(end.y).toBe(TRACK.Y0 + (TRACK.N - 1) * TRACK.ESP);
    expect(point(TRACK.CL + 1e6, 0)).toEqual(end);
    expect(point(TRACK.CL - 1e-9, 0).y).toBe(end.y);
    expect(path(0, 1e12, 8, 1000).length).toBeGreaterThan(0);
  });
  it('100 mil votos produzem ~6 px no tamanho de referência e a escala não muda', () => {
    const registered = 155_000_000,
      length = registered * TRACK_SHARE;
    const px = along(30_100_000, length) - along(30_000_000, length);
    expect(px).toBeGreaterThan(5);
    expect(px).toBeLessThan(7.5);
    expect(along(length * 2, length)).toBe(TRACK.CL);
    expect(along(-5, length)).toBe(0);
  });
});

const snapshot = (
  over: Omit<Partial<Snapshot>, 'votes'> & { votes?: Partial<Snapshot['votes']> } = {},
) =>
  ({
    id: 's',
    digest: over.digest ?? 'd',
    capturedAt: over.capturedAt ?? '2026-10-04T21:00:00.000Z',
    sections: over.sections ?? { total: 1000, totalized: 500, share: 0.5 },
    electorate: {
      total: 1000,
      totalized: 500,
      installed: 500,
      turnout: 400,
      share: 0.5,
      turnoutShare: 0.8,
    },
    votes: {
      total: 400,
      valid: 340,
      toCandidates: 350,
      blank: 20,
      null: 30,
      annulled: 10,
      subJudice: 0,
      ...over.votes,
    },
    candidates: over.candidates ?? [
      { id: 'x', number: '13', name: 'X', countedVotes: 150, validShare: 150 / 340 },
      { id: 'y', number: '22', name: 'Y', countedVotes: 140, validShare: 140 / 340 },
      { id: 'z', number: '30', name: 'Z', countedVotes: 50, validShare: 50 / 340 },
      { id: 'w', number: '99', name: 'W', countedVotes: 10, validShare: null },
    ],
  }) as unknown as Snapshot;

describe('meta ajustada e incrementos', () => {
  it('meta = metade dos válidos ainda possíveis; outros candidatos não a encurtam', () => {
    const s = snapshot();
    const r = raceState(s, ['x', 'y']);
    // 1000 registered − 100 abstentions − 50 blank/null − 10 annulled = 840 possible valid.
    expect(r.target).toBe(420);
    expect(r.toWin).toBe(421);
    expect(r.fixedLine).toBe(500);
    expect(r.trackVotes).toBe(550);
    expect(r.others).toBe(50);
    const more = snapshot({
      candidates: [
        { id: 'x', number: '13', name: 'X', countedVotes: 150, validShare: 0.4 },
        { id: 'y', number: '22', name: 'Y', countedVotes: 140, validShare: 0.4 },
        { id: 'z', number: '30', name: 'Z', countedVotes: 90, validShare: 0.2 },
      ] as Snapshot['candidates'],
    });
    expect(raceState(more, ['x', 'y']).target).toBe(r.target);
  });
  it('fim da apuração: meta exibida = floor(válidos / 2) + 1', () => {
    const s = snapshot({ votes: { annulled: 0 } });
    (s.electorate as { installed: number; turnout: number }).installed = 1000;
    (s.electorate as { installed: number; turnout: number }).turnout = 800;
    // 1000 − 200 abstentions − 50 blank/null = 750 valid in the end.
    expect(raceState(s, ['x', 'y']).toWin).toBe(Math.floor(750 / 2) + 1);
  });
  it('líderes ignoram votos anulados; incremento nunca negativo', () => {
    expect(leaders(snapshot()).map((c) => c.id)).toEqual(['x', 'y']);
    expect(increment(150, null)).toEqual({ from: 150, delta: null, corrected: false });
    expect(increment(150, 100)).toEqual({ from: 100, delta: 50, corrected: false });
    expect(increment(90, 100)).toEqual({ from: 90, delta: 0, corrected: true });
  });
  it('boletins distintos por conteúdo e ritmo só com observações reais', () => {
    const a = snapshot({
      digest: 'a',
      capturedAt: '2026-10-04T21:00:00.000Z',
      sections: { total: 1000, totalized: 100, share: 0.1 },
    });
    const b = snapshot({
      digest: 'a',
      capturedAt: '2026-10-04T21:01:00.000Z',
      sections: { total: 1000, totalized: 100, share: 0.1 },
    });
    const c = snapshot({
      digest: 'c',
      capturedAt: '2026-10-04T21:05:00.000Z',
      sections: { total: 1000, totalized: 300, share: 0.3 },
    });
    expect(bulletins([a, b, c]).map((s) => s.digest)).toEqual(['a', 'c']);
    expect(pace([c])).toBeNull();
    const p = pace(bulletins([a, b, c]))!;
    expect(p.sections).toBe(200);
    expect(p.minutes).toBe(5);
    expect(p.share).toBeCloseTo(20);
  });
});
