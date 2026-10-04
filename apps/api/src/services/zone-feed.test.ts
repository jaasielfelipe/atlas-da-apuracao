import { expect, it } from 'vitest';
import { Store } from '../db/store';
import { zoneFeed } from './zone-feed';

function insert(
  store: Store,
  id: string,
  unit: [string, string, string],
  at: string,
  totalized: number,
  votes: Record<string, number>,
) {
  const [uf, municipality, zone] = unit;
  const valid = Object.values(votes).reduce((a, b) => a + b, 0);
  store.db
    .prepare('INSERT INTO zone_result VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .run(
      id,
      'official',
      2026,
      '6257',
      '1',
      uf,
      municipality,
      zone,
      at,
      `https://x/${id}`,
      id,
      totalized === 10 ? 'complete' : 'partial',
      10,
      totalized,
      10 - totalized,
      valid,
    );
  const vote = store.db.prepare('INSERT INTO zone_candidate_vote VALUES(?,?,?)');
  for (const [c, v] of Object.entries(votes)) vote.run(id, c, v);
}

it('feed de zonas: acréscimos desde a versão anterior, mais recentes primeiro, sem regressões', () => {
  const store = new Store(':memory:');
  try {
    const a: [string, string, string] = ['ac', '01120', '0008'];
    const b: [string, string, string] = ['sp', '71072', '0001'];
    insert(store, 'a1', a, '2026-10-04T20:00:00.000Z', 2, { L: 100, F: 80, C: 10 });
    insert(store, 'b1', b, '2026-10-04T20:01:00.000Z', 3, { L: 50, F: 70 }); // first version: from zero
    insert(store, 'a2', a, '2026-10-04T20:02:00.000Z', 5, { L: 260, F: 190, C: 30 });
    insert(store, 'b2', b, '2026-10-04T20:03:00.000Z', 3, { L: 50, F: 70 }); // no new sections
    insert(store, 'a3', a, '2026-10-04T20:04:00.000Z', 4, { L: 200, F: 150, C: 20 }); // correction down
    const feed = zoneFeed(store.db, 'official', [
      {
        id: 'ac:01120',
        kind: 'municipality',
        name: 'ACRELÂNDIA',
        uf: 'ac',
        tseCode: '01120',
        ibgeCode: null,
        parentId: 'ac',
      },
    ]);
    expect(feed.map((f) => f.capturedAt)).toEqual([
      '2026-10-04T20:02:00.000Z',
      '2026-10-04T20:01:00.000Z',
      '2026-10-04T20:00:00.000Z',
    ]);
    expect(feed[0]).toMatchObject({
      uf: 'ac',
      zone: '0008',
      municipalityName: 'ACRELÂNDIA',
      sections: { total: 10, totalized: 5, added: 3 },
      validAdded: 290,
      added: { L: 160, F: 110, C: 20 },
    });
    expect(feed[1]).toMatchObject({
      uf: 'sp',
      municipalityName: null,
      sections: { added: 3 },
      added: { L: 50, F: 70 },
    });
    expect(zoneFeed(store.db, 'official', [], 1)).toHaveLength(1);
    expect(zoneFeed(store.db, 'simulated', [])).toEqual([]);
  } finally {
    store.close();
  }
});
