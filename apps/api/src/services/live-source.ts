import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { Store } from '../db/store';
import { parseCatalog } from '../../../../packages/tse/src/index';
import type { Territory } from '../../../../packages/domain/src/index';
import { comparisonUnavailable, type DashboardContext, type DashboardSource } from './dashboard';
import { officialComparisonHandler } from './official-comparison';

export type CollectionState = {
  running: boolean;
  lastObservation: string | null;
  /** Latest collector heartbeat (rate, pause) while running; null otherwise. */
  collector: unknown;
  coverage: {
    expectedSegments: number;
    observedSegments: number;
    completeSegments: number;
    expectedZones: number;
    completeZones: number;
  } | null;
};

/**
 * Dashboard source over a collector's own SQLite (`data/<env>/collection.sqlite`). WAL lets it read
 * while the collector writes; the only write is the watchlist, which the live collector re-reads.
 * Never mixes environments and never falls back to fixture data.
 */
export function liveSource(
  environment: 'official' | 'simulated',
  path: string,
  comparison?: { historyPath: string; root: string },
): DashboardSource & { close(): void } {
  let store: Store | null = null;
  let catalog: { digest: string; territories: Territory[] } | null = null;
  const official =
    environment === 'official' && comparison
      ? officialComparisonHandler(path, comparison.historyPath, comparison.root)
      : null;
  function collection(ctx: DashboardContext): CollectionState {
    const db = ctx.store.db;
    const lease = db.prepare('SELECT expires FROM collector_owner WHERE id=1').get() as
      | { expires: number }
      | undefined;
    const running = Boolean(lease && lease.expires > Date.now());
    let collector: unknown = null;
    const statusFile = resolve(dirname(path), 'collector-status.json');
    if (running && existsSync(statusFile))
      try {
        const s = JSON.parse(readFileSync(statusFile, 'utf8'));
        collector = { updatedAt: s.updatedAt, rate: s.rate };
      } catch {
        collector = null; // status file mid-write; lease still says running
      }
    const registry = db
      .prepare('SELECT id FROM zone_registry WHERE environment=? ORDER BY captured_at DESC LIMIT 1')
      .get(environment) as { id: string } | undefined;
    const coverage = registry
      ? (db
          .prepare(
            `WITH latest AS (SELECT *,ROW_NUMBER() OVER(PARTITION BY uf,municipality,zone ORDER BY captured_at DESC) rn FROM zone_result WHERE environment=? AND year=2026), zones AS (SELECT s.uf,s.zone,COUNT(*) expected,COUNT(r.id) observed,SUM(CASE WHEN r.status='complete' THEN 1 ELSE 0 END) complete FROM zone_segment s LEFT JOIN latest r ON r.uf=s.uf AND r.municipality=s.municipality AND r.zone=s.zone AND r.rn=1 WHERE s.registry_id=? GROUP BY s.uf,s.zone) SELECT COALESCE(SUM(expected),0) expectedSegments,COALESCE(SUM(observed),0) observedSegments,COALESCE(SUM(complete),0) completeSegments,COUNT(*) expectedZones,COALESCE(SUM(CASE WHEN expected=complete THEN 1 ELSE 0 END),0) completeZones FROM zones`,
          )
          .get(environment, registry.id) as CollectionState['coverage'])
      : null;
    const last = db.prepare('SELECT MAX(completed_at) at FROM collector_observation').get() as {
      at: string | null;
    };
    return { running, lastObservation: last.at, collector, coverage };
  }
  return {
    environment,
    coverageBasis: 'ea20',
    open() {
      if (!store) {
        if (!existsSync(path))
          return {
            unavailable: `Acervo ${environment} ainda não coletado. Execute collect:${environment}:live.`,
          };
        const opened = new Store(path);
        const mixed = opened.db
          .prepare(
            'SELECT 1 FROM snapshot WHERE environment<>? UNION SELECT 1 FROM zone_registry WHERE environment<>? LIMIT 1',
          )
          .get(environment, environment);
        if (mixed) {
          opened.close();
          throw Error('Acervo contém ambiente incompatível');
        }
        store = opened;
      }
      const body = store.db
        .prepare(
          "SELECT c.body_digest digest,b.compressed FROM collector_cache c JOIN collector_body b ON b.digest=c.body_digest WHERE c.job_key='bootstrap:ea12'",
        )
        .get() as { digest: string; compressed: Buffer } | undefined;
      if (!body) return { unavailable: 'Cadastro EA12 ainda não capturado neste acervo' };
      if (catalog?.digest !== body.digest)
        catalog = {
          digest: body.digest,
          territories: parseCatalog(
            JSON.parse(gunzipSync(body.compressed).toString('utf8')),
            environment,
          ),
        };
      return { store, territories: catalog.territories };
    },
    bootstrap(ctx) {
      const state = collection(ctx);
      return {
        dataset:
          environment === 'official'
            ? 'Capturas do ambiente oficial do TSE'
            : 'Capturas do ambiente simulado do TSE — não são resultados oficiais',
        capabilities: {
          officialCollection: environment === 'official',
          cohort: environment === 'official',
          historical: false,
        },
        fixtureStep: 0,
        fixtureSteps: 0,
        collectionRunning: state.running,
        collection: state,
      };
    },
    comparison(request, reply, _ctx, q) {
      if (official) return official(request, reply);
      return Promise.resolve(
        comparisonUnavailable(
          environment,
          q.selected,
          q.office,
          'Candidaturas simuladas não se vinculam às séries históricas oficiais',
        ),
      );
    },
    close() {
      store?.close();
      store = null;
    },
  };
}
