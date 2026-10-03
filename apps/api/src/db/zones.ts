import type { Store } from './store';
import type { Environment } from '../../../../packages/domain/src/index';
import {
  type ZoneDataset,
  type ZoneResult,
  type ZoneMatch,
  type Year,
} from '../../../../packages/domain/src/zones';
import { validateOrigin } from '../../../../packages/tse/src/index';

export class ZoneStore {
  constructor(readonly store: Pick<Store, 'db'>) {}
  insertFixture(dataset: ZoneDataset) {
    // Official ingestion requires a separate audited import path; fixtures cannot enable it.
    if (dataset.environment !== 'fixture') throw Error('Ingestão disponível apenas para fixture');
    const db = this.store.db,
      registryId = `${dataset.environment}:${dataset.registryDigest}`;
    db.transaction(() => {
      db.prepare('INSERT OR IGNORE INTO zone_registry VALUES(?,?,?,?,?)').run(
        registryId,
        dataset.environment,
        dataset.capturedAt,
        Number(dataset.registryComplete),
        dataset.registryDigest,
      );
      for (const s of dataset.segments)
        db.prepare('INSERT OR IGNORE INTO zone_segment VALUES(?,?,?,?)').run(
          registryId,
          s.uf,
          s.municipality,
          s.zone,
        );
      for (const [year, m] of Object.entries(dataset.mappings))
        db.prepare('INSERT OR IGNORE INTO zone_candidate_mapping VALUES(?,?,?,?)').run(
          registryId,
          Number(year),
          m.bolsonaro,
          m.lula_haddad,
        );
      for (const r of dataset.results) {
        if (r.environment !== dataset.environment) throw Error('Ambiente misturado');
        validateOrigin(r.sourceUrl, r.environment);
        const inserted = db
          .prepare(
            `INSERT OR IGNORE INTO zone_result VALUES(@id,@environment,@year,@election,@round,@uf,@municipality,@zone,@capturedAt,@sourceUrl,@sourceDigest,@status,@total,@totalized,@notTotalized,@valid)`,
          )
          .run(r);
        if (inserted.changes)
          for (const c of r.candidates)
            db.prepare('INSERT INTO zone_candidate_vote VALUES(?,?,?)').run(r.id, c.id, c.votes);
      }
      for (const m of dataset.matches)
        db.prepare('INSERT OR IGNORE INTO zone_match VALUES(?,?,?,?,?,?,?,?,?,?)').run(
          m.id,
          registryId,
          m.current,
          m.historical2018,
          m.historical2022,
          m.status,
          m.capturedAt,
          m.method,
          m.evidence,
          m.registryDigest,
        );
    })();
  }
  load(environment: Environment, at: string): ZoneDataset | null {
    const db = this.store.db;
    const r = db
      .prepare(
        'SELECT * FROM zone_registry WHERE environment=? AND captured_at<=? ORDER BY captured_at DESC LIMIT 1',
      )
      .get(environment, at) as
      | { id: string; captured_at: string; complete: number; digest: string }
      | undefined;
    if (!r) return null;
    const results = db
      .prepare(
        `SELECT id,environment,year,election,round,uf,municipality,zone,captured_at AS capturedAt,source_url AS sourceUrl,source_digest AS sourceDigest,status,total,totalized,not_totalized AS notTotalized,valid FROM zone_result WHERE environment=? AND captured_at<=? ORDER BY captured_at`,
      )
      .all(environment, at) as ZoneResult[];
    const votes = db
      .prepare(
        `SELECT v.result_id, v.candidate_id AS id,v.votes FROM zone_candidate_vote v JOIN zone_result r ON r.id=v.result_id WHERE r.environment=? AND r.captured_at<=?`,
      )
      .all(environment, at) as { result_id: string; id: string; votes: number }[];
    const grouped = new Map<string, { id: string; votes: number }[]>();
    for (const v of votes) {
      const a = grouped.get(v.result_id) ?? [];
      a.push({ id: v.id, votes: v.votes });
      grouped.set(v.result_id, a);
    }
    results.forEach((result) => (result.candidates = grouped.get(result.id) ?? []));
    const mapping = db
      .prepare('SELECT year,bolsonaro,lula_haddad FROM zone_candidate_mapping WHERE registry_id=?')
      .all(r.id) as { year: Year; bolsonaro: string; lula_haddad: string }[];
    return {
      environment,
      capturedAt: r.captured_at,
      registryDigest: r.digest,
      registryComplete: Boolean(r.complete),
      segments: db
        .prepare(
          'SELECT uf,municipality,zone FROM zone_segment WHERE registry_id=? ORDER BY uf,municipality,zone',
        )
        .all(r.id) as ZoneDataset['segments'],
      results,
      mappings: Object.fromEntries(
        mapping.map((m) => [m.year, { bolsonaro: m.bolsonaro, lula_haddad: m.lula_haddad }]),
      ) as ZoneDataset['mappings'],
      matches: db
        .prepare(
          `SELECT id,current_key AS current,historical_2018 AS historical2018,historical_2022 AS historical2022,status,captured_at AS capturedAt,method,evidence,registry_digest AS registryDigest FROM zone_match WHERE registry_id=? AND captured_at<=?`,
        )
        .all(r.id, at) as ZoneMatch[],
    };
  }
}
