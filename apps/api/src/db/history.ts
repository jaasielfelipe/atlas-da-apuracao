import type { Store } from './store';
import { importNominalHistory } from '../../../../packages/tse/src/history';
export function persistHistory(
  store: Store,
  bytes: Uint8Array,
  year: 2018 | 2022,
  sourceUrl: string,
  capturedAt: string,
) {
  const source = new URL(sourceUrl);
  if (source.protocol !== 'https:' || source.hostname !== 'cdn.tse.jus.br')
    throw Error('Origem histórica inválida');
  if (new Date(capturedAt).toISOString() !== capturedAt) throw Error('Captura histórica inválida');
  const parsed = importNominalHistory(bytes, year),
    id = `${year}:${parsed.sha256}`,
    db = store.db;
  db.transaction(() => {
    const inserted = db
      .prepare('INSERT OR IGNORE INTO historical_import VALUES(?,?,?,?,?,?,?,?,?)')
      .run(
        id,
        year,
        parsed.election,
        capturedAt,
        sourceUrl,
        parsed.sha256,
        parsed.encoding,
        parsed.imported,
        'pending_reconciliation',
      );
    if (!inserted.changes) return;
    const segment = db.prepare('INSERT INTO historical_segment VALUES(?,?,?,?,?)'),
      vote = db.prepare('INSERT INTO historical_vote VALUES(?,?,?,?,?,?,?,?)');
    for (const s of parsed.segments) {
      segment.run(id, s.uf, s.municipality, s.zone, s.valid);
      for (const c of s.candidates)
        vote.run(id, s.uf, s.municipality, s.zone, c.id, c.number, c.name, c.votes);
    }
  })();
  return {
    id,
    year,
    segments: parsed.segments.length,
    candidates: parsed.imported,
    status: 'pending_reconciliation',
  };
}
