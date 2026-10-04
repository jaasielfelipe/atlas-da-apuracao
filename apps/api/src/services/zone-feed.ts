import type Database from 'better-sqlite3';
import type { Territory } from '../../../../packages/domain/src/index';

export type ZoneFeedItem = {
  /** município–zona unit (never a whole-zone total). */
  uf: string;
  municipality: string;
  municipalityName: string | null;
  zone: string;
  capturedAt: string;
  status: string;
  sections: { total: number; totalized: number; added: number };
  /** Valid votes added since the previous version of this unit. */
  validAdded: number;
  /** Votes added per candidate id since the previous version (valid candidates only). */
  added: Record<string, number>;
};

type Row = {
  id: string;
  uf: string;
  municipality: string;
  zone: string;
  captured_at: string;
  status: string;
  total: number;
  totalized: number;
  valid: number | null;
  prev_id: string | null;
  prev_totalized: number | null;
  prev_valid: number | null;
};

/**
 * Latest município–zona versions that counted new sections, newest first, with the increase since
 * the previous captured version of the same unit (the first version counts from zero). Read-only.
 * Corrections that lower a count are not shown as negative additions: they are skipped here.
 */
export function zoneFeed(
  db: Database.Database,
  environment: string,
  territories: Territory[],
  limit = 12,
): ZoneFeedItem[] {
  const rows = db
    .prepare(
      `WITH recent AS (
         SELECT * FROM zone_result WHERE environment=? AND year=2026
         ORDER BY captured_at DESC, id DESC LIMIT ?
       )
       SELECT r.id, r.uf, r.municipality, r.zone, r.captured_at, r.status, r.total, r.totalized, r.valid,
         p.id prev_id, p.totalized prev_totalized, p.valid prev_valid
       FROM recent r
       LEFT JOIN zone_result p ON p.id = (
         SELECT q.id FROM zone_result q
         WHERE q.environment=r.environment AND q.year=2026 AND q.uf=r.uf AND q.zone=r.zone
           AND q.municipality=r.municipality AND q.captured_at < r.captured_at
         ORDER BY q.captured_at DESC LIMIT 1
       )
       ORDER BY r.captured_at DESC, r.id DESC`,
    )
    .all(environment, limit * 6) as Row[];
  const votes = db.prepare(
    'SELECT candidate_id id, votes FROM zone_candidate_vote WHERE result_id=?',
  );
  const names = new Map(territories.map((t) => [t.id, t.name]));
  const out: ZoneFeedItem[] = [];
  for (const r of rows) {
    const added = r.totalized - (r.prev_totalized ?? 0);
    if (added <= 0) continue;
    const now = new Map(
      (votes.all(r.id) as { id: string; votes: number }[]).map((v) => [v.id, v.votes]),
    );
    const before = r.prev_id
      ? new Map(
          (votes.all(r.prev_id) as { id: string; votes: number }[]).map((v) => [v.id, v.votes]),
        )
      : new Map<string, number>();
    const perCandidate: Record<string, number> = {};
    for (const [id, v] of now) perCandidate[id] = Math.max(0, v - (before.get(id) ?? 0));
    out.push({
      uf: r.uf,
      municipality: r.municipality,
      municipalityName: names.get(`${r.uf}:${r.municipality}`) ?? null,
      zone: r.zone,
      capturedAt: r.captured_at,
      status: r.status,
      sections: { total: r.total, totalized: r.totalized, added },
      validAdded: Math.max(0, (r.valid ?? 0) - (r.prev_valid ?? 0)),
      added: perCandidate,
    });
    if (out.length >= limit) break;
  }
  return out;
}
