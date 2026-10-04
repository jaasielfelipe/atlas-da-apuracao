import { expect, it } from 'vitest';
import { changedTerritories, mergeTimeline } from './changes';
import type { Snapshot } from '../../../../packages/domain/src/index';

const row = (id: string, digest: string, totalized: number) => ({
  territoryId: id,
  snapshot: { digest, sections: { totalized } } as unknown as Snapshot,
});

it('UFs alteradas: só com snapshot anterior, maior avanço de seções primeiro, limitado', () => {
  const before = [row('sp', 'a', 10), row('mg', 'b', 5), row('rj', 'c', 7), row('ba', 'd', 1)];
  const after = [
    row('sp', 'a2', 40),
    row('mg', 'b', 5),
    row('rj', 'c2', 8),
    row('ba', 'd2', 20),
    row('ce', 'e', 3),
  ];
  expect(changedTerritories(null, after)).toEqual([]);
  expect(changedTerritories(before, after)).toEqual([
    { id: 'sp', sections: 30 },
    { id: 'ba', sections: 19 },
    { id: 'rj', sections: 1 },
  ]);
  expect(changedTerritories(before, after, 1)).toEqual([{ id: 'sp', sections: 30 }]);
  // A correction that lowers the count is still a change (never a negative advance).
  expect(changedTerritories([row('sp', 'a', 10)], [row('sp', 'z', 8)])).toEqual([
    { id: 'sp', sections: 0 },
  ]);
});

it('linha do tempo acumulada: um ponto por instante, ordenada, sem duplicar, com teto', () => {
  const p = (at: string, v: number) => ({ at, v });
  const merged = mergeTimeline(
    [p('2026-10-04T20:01', 1), p('2026-10-04T20:02', 2)],
    [p('2026-10-04T20:02', 3), p('2026-10-04T20:03', 4)],
  );
  expect(merged).toEqual([
    p('2026-10-04T20:01', 1),
    p('2026-10-04T20:02', 3),
    p('2026-10-04T20:03', 4),
  ]);
  expect(mergeTimeline(merged, [], 2).map((x) => x.v)).toEqual([3, 4]);
});
