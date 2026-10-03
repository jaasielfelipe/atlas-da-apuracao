import type Database from 'better-sqlite3';
import { structuralReconciliation } from '../../../../packages/tse/src/reconciliation';
import { digest } from '../../../../packages/tse/src/index';
import {
  segmentId,
  type ZoneDataset,
  type ZoneResult,
  type ZoneSegment,
} from '../../../../packages/domain/src/zones';

export type TerritorialApproval = {
  id: string;
  capturedAt: string;
  registryDigest: string;
  import2018: string;
  import2022: string;
  actor: 'user';
  statement: string;
};
type HistoricalImport = {
  id: string;
  year: 2018 | 2022;
  election: string;
  captured_at: string;
  source_url: string;
  raw_digest: string;
};
const method = 'user_accepted_structural';
function imports(db: Database.Database, ids: string[]) {
  return ids.map((id, i) => {
    const row = db.prepare('SELECT * FROM historical_import WHERE id=?').get(id) as
      | HistoricalImport
      | undefined;
    if (!row || row.year !== [2018, 2022][i]) throw Error('Importação histórica incompatível');
    return row;
  });
}
function segments(db: Database.Database, id: string) {
  return db
    .prepare('SELECT uf,municipality,zone FROM historical_segment WHERE import_id=?')
    .all(id) as ZoneSegment[];
}

/** Explicit user decision, not documentary evidence produced by this software. Append only. */
export function acceptTerritorialAudit(
  db: Database.Database,
  current: ZoneSegment[],
  approval: TerritorialApproval,
) {
  if (
    !approval.id ||
    approval.actor !== 'user' ||
    !approval.statement.trim() ||
    !approval.registryDigest ||
    !Number.isFinite(Date.parse(approval.capturedAt)) ||
    new Date(approval.capturedAt).toISOString() !== approval.capturedAt
  )
    throw Error('Aceite inválido');
  return db.transaction(() => {
    const history = imports(db, [approval.import2018, approval.import2022]);
    if (history.some((h) => h.captured_at > approval.capturedAt))
      throw Error('Aceite anterior à importação');
    const report = structuralReconciliation(
      current,
      segments(db, history[0].id),
      segments(db, history[1].id),
    );
    const accepted = report.details.filter((z) => z.status === 'review' && !z.exterior);
    const evidence = JSON.stringify({
      ...approval,
      documentaryAuditByAgent: false,
      scope: 'compatible_domestic_whole_zones',
    });
    for (const z of accepted) {
      const id = digest([approval.id, z.key]);
      const previous = db.prepare('SELECT evidence FROM territorial_audit WHERE id=?').get(id) as
        | { evidence: string }
        | undefined;
      if (previous && previous.evidence !== evidence) throw Error('Aceite imutável divergente');
      db.prepare('INSERT OR IGNORE INTO territorial_audit VALUES(?,?,?,?,?,?,?,?,?,?)').run(
        id,
        approval.capturedAt,
        approval.registryDigest,
        history[0].id,
        history[1].id,
        ...z.key.split(':'),
        'verified',
        method,
        evidence,
      );
    }
    return {
      acceptedZones: accepted.length,
      acceptedSegments: accepted.reduce((n, z) => n + z.municipalities.length, 0),
      excludedZones: report.zones - accepted.length,
      multiSegmentZones: report.multiSegmentDomesticZones,
    };
  })();
}

/** Attach final historical votes to an official EA20 dataset; no invented section counts. */
export function attachAcceptedHistory(
  db: Database.Database,
  current: ZoneDataset,
  at: string,
): ZoneDataset {
  if (current.environment !== 'official') throw Error('Históricos reais exigem ambiente oficial');
  if (!Number.isFinite(Date.parse(at)) || new Date(at).toISOString() !== at)
    throw Error('Instante inválido');
  if (current.results.some((r) => r.environment !== 'official' || r.year !== 2026))
    throw Error('Acervo atual incompatível');
  return db.transaction(() => {
    const audits = db
      .prepare(
        `SELECT * FROM territorial_audit WHERE current_registry_digest=? AND captured_at<=? ORDER BY captured_at,id`,
      )
      .all(current.registryDigest, at) as {
      id: string;
      captured_at: string;
      import_2018: string;
      import_2022: string;
      uf: string;
      zone: string;
      status: string;
      method: string;
      evidence: string;
    }[];
    const latest = new Map<string, (typeof audits)[number]>();
    for (const a of audits) {
      const key = `${a.uf}:${a.zone}`,
        previous = latest.get(key);
      if (previous?.captured_at === a.captured_at && previous.id !== a.id)
        throw Error('Auditoria temporal ambígua');
      latest.set(key, a);
    }
    const accepted = [...latest.values()].filter(
      (a) => a.status === 'verified' && a.method === method && a.uf !== 'zz',
    );
    const pairs = new Set(accepted.map((a) => `${a.import_2018}|${a.import_2022}`));
    if (pairs.size > 1) throw Error('Versões históricas divergentes');
    const output = {
      ...current,
      results: [...current.results],
      matches: [] as ZoneDataset['matches'],
    };
    if (!accepted.length) return output;
    const history = imports(db, [accepted[0].import_2018, accepted[0].import_2022]);
    if (history.some((h) => h.captured_at > at)) throw Error('Histórico futuro');
    const structural = structuralReconciliation(
      current.segments,
      segments(db, history[0].id),
      segments(db, history[1].id),
    );
    const compatible = new Set(
      structural.details.filter((z) => z.status === 'review' && !z.exterior).map((z) => z.key),
    );
    for (const a of accepted) {
      if (!compatible.has(`${a.uf}:${a.zone}`))
        throw Error('Aceite incompatível com o cadastro atual');
      const evidence = JSON.parse(a.evidence) as TerritorialApproval;
      if (
        evidence.actor !== 'user' ||
        evidence.registryDigest !== current.registryDigest ||
        evidence.import2018 !== a.import_2018 ||
        evidence.import2022 !== a.import_2022 ||
        !evidence.statement
      )
        throw Error('Proveniência de aceite inválida');
    }
    const byZone = new Map(accepted.map((a) => [`${a.uf}:${a.zone}`, a]));
    for (const s of current.segments) {
      const a = byZone.get(`${s.uf}:${s.zone}`);
      if (!a) continue;
      const key = segmentId(s);
      output.matches.push({
        id: `${a.id}:${key}`,
        current: key,
        historical2018: key,
        historical2022: key,
        status: 'verified',
        capturedAt: a.captured_at,
        method: a.method,
        evidence: a.evidence,
        registryDigest: current.registryDigest,
      });
    }
    for (const h of history) {
      const votes = db
        .prepare(
          'SELECT uf,municipality,zone,candidate_id AS id,votes FROM historical_vote WHERE import_id=?',
        )
        .all(h.id) as (ZoneSegment & { id: string; votes: number })[];
      const grouped = new Map<string, ZoneResult['candidates']>();
      for (const v of votes) {
        const key = segmentId(v),
          rows = grouped.get(key) ?? [];
        rows.push({ id: v.id, votes: v.votes });
        grouped.set(key, rows);
      }
      const rows = db
        .prepare('SELECT uf,municipality,zone,valid FROM historical_segment WHERE import_id=?')
        .all(h.id) as (ZoneSegment & { valid: number })[];
      for (const s of rows)
        output.results.push({
          ...s,
          id: `${h.id}:${segmentId(s)}`,
          environment: 'official',
          year: h.year,
          election: h.election,
          round: '1',
          capturedAt: h.captured_at,
          sourceUrl: h.source_url,
          sourceDigest: h.raw_digest,
          status: 'complete',
          basis: 'historical_final',
          total: null,
          totalized: null,
          notTotalized: null,
          candidates: grouped.get(segmentId(s)) ?? [],
        });
    }
    return output;
  })();
}
