import Database from 'better-sqlite3';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import {
  acceptTerritorialAudit,
  attachAcceptedHistory,
  type TerritorialApproval,
} from '../apps/api/src/db/territorial';
import { parseZoneRegistry, normalizeZone } from '../packages/tse/src/zones';
import { discoverElection, rawDigest } from '../packages/tse/src/index';
import { compareZones, validResult, type ZoneDataset } from '../packages/domain/src/zones';

// Replay the user's one-time decision. This command makes no network requests.
const json = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const proofPath = 'docs/evidence/national/territorial-user-acceptance.json';
const db = new Database('data/history/atlas-history.sqlite', { fileMustExist: true });
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');
try {
  const registry = parseZoneRegistry(
    json('packages/fixtures/zonal/official-ea12.json'),
    'official',
  );
  const inventory = json('docs/evidence/national/reconciliation.json');
  if (inventory.registryDigest !== registry.digest)
    throw Error('Cadastro alterado desde inventário');
  const history = [2018, 2022].map((year) => {
    const rows = db.prepare('SELECT * FROM historical_import WHERE year=?').all(year) as any[];
    const manifest = json(`packages/fixtures/history/${year}-manifest.json`);
    if (
      rows.length !== 1 ||
      rows[0].raw_digest !== manifest.sha256 ||
      rows[0].election !== manifest.election ||
      rawDigest(readFileSync(`data/history/${year}-BR.csv`)) !== manifest.sha256
    )
      throw Error('Histórico alterado/ambíguo');
    return rows[0];
  });
  const approval: TerritorialApproval = existsSync(proofPath)
    ? json(proofPath).approval
    : {
        id: 'user-decision-2026-10-03-territorial-audit',
        capturedAt: new Date().toISOString(),
        registryDigest: registry.digest,
        import2018: history[0].id,
        import2022: history[1].id,
        actor: 'user',
        statement:
          'decisão: considere auditoria realizada. vamos com estado atual. pode atualizar o status. siga para os próximos passos.',
      };
  if (
    approval.registryDigest !== registry.digest ||
    approval.import2018 !== history[0].id ||
    approval.import2022 !== history[1].id
  )
    throw Error('Aceite não corresponde às fontes atuais');
  const identities = json('packages/fixtures/history/series-identities.json');
  const observations = json('packages/fixtures/zonal/observation.json') as any[];
  const o = observations.find((o) => o.file === 'official-ac01120-z0008.json');
  const raw = readFileSync(`packages/fixtures/zonal/${o.file}`, 'utf8');
  if (rawDigest(raw) !== o.sha256 || o.sha256 !== identities[2026].rawSha256)
    throw Error('EA20 alterado');
  const context = discoverElection(
    json('packages/fixtures/official/ea11.json'),
    'official',
    'president',
  );
  const normalized = normalizeZone(JSON.parse(raw), {
    ...context,
    uf: 'ac',
    municipality: '01120',
    zone: '0008',
    sourceUrl: o.url,
    capturedAt: o.capturedAt,
    raw,
    registry,
  });
  for (const year of [2018, 2022, 2026]) {
    const candidates =
      year === 2026
        ? JSON.parse(raw)
            .carg.flatMap((c: any) => c.agr.flatMap((a: any) => a.par.flatMap((p: any) => p.cand)))
            .map((c: any) => ({ id: c.sqcand, number: c.n, name: c.nm }))
        : (db
            .prepare(
              'SELECT DISTINCT candidate_id AS id,number,name FROM historical_vote WHERE import_id=?',
            )
            .all(history[year === 2018 ? 0 : 1].id) as any[]);
    const election = year === 2026 ? context.electionId : history[year === 2018 ? 0 : 1].election;
    if (identities[year].election !== election) throw Error('Eleição incompatível com identidades');
    for (const series of ['bolsonaro', 'lula_haddad']) {
      const identity = identities[year][series];
      if (
        !candidates.some(
          (c) => c.id === identity.id && c.number === identity.number && c.name === identity.name,
        )
      )
        throw Error('Identidade não comprovada');
    }
  }
  mkdirSync('data/backups', { recursive: true });
  const backup = `data/backups/history-before-user-audit-${new Date().toISOString().replaceAll(':', '-')}.sqlite`;
  await db.backup(backup);
  const copy = new Database(backup, { readonly: true });
  try {
    if (copy.pragma('integrity_check', { simple: true }) !== 'ok') throw Error('Backup inválido');
  } finally {
    copy.close();
  }
  const accepted = acceptTerritorialAudit(db, registry.segments, approval);
  const s = normalized.snapshot;
  const current: ZoneDataset = {
    environment: 'official',
    registryDigest: registry.digest,
    registryComplete: true,
    capturedAt: observations.find((o) => o.file === 'official-ea12.json').capturedAt,
    segments: registry.segments,
    matches: [],
    mappings: Object.fromEntries(
      [2018, 2022, 2026].map((year) => [
        year,
        { bolsonaro: identities[year].bolsonaro.id, lula_haddad: identities[year].lula_haddad.id },
      ]),
    ) as ZoneDataset['mappings'],
    results: [
      {
        ...normalized.segment,
        id: s.id,
        environment: 'official',
        year: 2026,
        election: s.electionId,
        round: '1',
        capturedAt: s.capturedAt,
        sourceUrl: s.sourceUrl,
        sourceDigest: s.rawDigest,
        status: normalized.status,
        total: s.sections.total,
        totalized: s.sections.totalized,
        notTotalized: s.sections.total - s.sections.totalized,
        valid: s.votes.valid,
        candidates: normalized.validCandidates,
      },
    ],
  };
  const dataset = attachAcceptedHistory(db, current, approval.capturedAt);
  const comparison = compareZones(dataset, approval.capturedAt);
  const report = {
    approval,
    method: 'user_accepted_structural',
    documentaryAuditByAgent: false,
    ...accepted,
    excludedSegments: registry.segments.length - accepted.acceptedSegments,
    acceptancePercent: (100 * accepted.acceptedSegments) / registry.segments.length,
    attachedMatches: dataset.matches.length,
    historicalResults: dataset.results.filter((r) => r.year !== 2026).length,
    validHistoricalResults: dataset.results.filter((r) => r.year !== 2026 && validResult(r)).length,
    officialSample: {
      capturedAt: s.capturedAt,
      sourceUrl: s.sourceUrl,
      digest: s.rawDigest,
      status: normalized.status,
    },
    comparisonCoverage: comparison.coverage,
    nationalOfficialCollectionValidated: false,
    integrity: db.pragma('integrity_check', { simple: true }),
    backup,
  };
  writeFileSync(proofPath, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally {
  db.close();
}
