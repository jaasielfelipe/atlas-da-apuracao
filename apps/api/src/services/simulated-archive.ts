import Database from 'better-sqlite3';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseCatalog } from '../../../../packages/tse/src/index';
import type { Snapshot } from '../../../../packages/domain/src/index';

/** Read-only, independently named routes: never substitute simulated data in fixture/official APIs. */
export function registerSimulatedArchive(
  app: FastifyInstance,
  path: string,
  environment: 'official' | 'simulated' = 'simulated',
) {
  function read<T>(fn: (db: Database.Database) => T): T | null {
    if (!existsSync(path)) return null;
    const db = new Database(path, { readonly: true, fileMustExist: true });
    try {
      if (db.pragma('user_version', { simple: true }) !== 5)
        throw Error('Acervo simulado exige versão de banco compatível');
      const mixed = db
        .prepare(
          'SELECT 1 FROM snapshot WHERE environment<>? UNION SELECT 1 FROM zone_registry WHERE environment<>? LIMIT 1',
        )
        .get(environment, environment);
      if (mixed) throw Error('Acervo simulado contém ambiente incompatível');
      return db.transaction(() => fn(db))();
    } finally {
      db.close();
    }
  }
  app.get(`/api/v1/${environment}/archive`, async (_request, reply) => {
    const result = read((db) => {
      const registry = db
        .prepare(
          'SELECT id,digest,captured_at FROM zone_registry WHERE environment=? ORDER BY captured_at DESC LIMIT 1',
        )
        .get(environment) as { id: string; digest: string; captured_at: string } | undefined;
      const body = db
        .prepare(
          "SELECT b.compressed FROM collector_cache c JOIN collector_body b ON b.digest=c.body_digest WHERE c.job_key='bootstrap:ea12'",
        )
        .get() as { compressed: Buffer } | undefined;
      const territories = body
        ? parseCatalog(
            JSON.parse(gunzipSync(body.compressed).toString('utf8')),
            environment,
          ).filter((t) => t.kind !== 'municipality')
        : [];
      const coverage = registry
        ? db
            .prepare(
              `WITH latest AS (SELECT *,ROW_NUMBER() OVER(PARTITION BY uf,municipality,zone ORDER BY captured_at DESC) rn FROM zone_result WHERE environment=? AND year=2026), zones AS (SELECT s.uf,s.zone,COUNT(*) expected,COUNT(r.id) observed,SUM(CASE WHEN r.status='complete' THEN 1 ELSE 0 END) complete FROM zone_segment s LEFT JOIN latest r ON r.uf=s.uf AND r.municipality=s.municipality AND r.zone=s.zone AND r.rn=1 WHERE s.registry_id=? GROUP BY s.uf,s.zone) SELECT SUM(expected) expectedSegments,SUM(observed) observedSegments,SUM(complete) completeSegments,COUNT(*) expectedZones,SUM(CASE WHEN expected=complete THEN 1 ELSE 0 END) completeZones FROM zones`,
            )
            .get(environment, registry.id)
        : null;
      const last = db.prepare('SELECT MAX(completed_at) at FROM collector_observation').get() as {
        at: string | null;
      };
      // Collector lease (renewed every 5 s, expires after 60 s) is the source of truth for liveness.
      const lease = db.prepare('SELECT expires FROM collector_owner WHERE id=1').get() as
        | { expires: number }
        | undefined;
      const statusFile = resolve(dirname(path), 'collector-status.json');
      let collector: unknown = null;
      if (lease && lease.expires > Date.now() && existsSync(statusFile))
        try {
          const s = JSON.parse(readFileSync(statusFile, 'utf8'));
          collector = { updatedAt: s.updatedAt, rate: s.rate, coverage: s.coverage };
        } catch {
          collector = null; // status file mid-write; lease still says running
        }
      return {
        environment,
        mode: 'read_only_archive',
        collectionRunning: Boolean(lease && lease.expires > Date.now()),
        collectionRunningKnown: true,
        collector,
        lastObservation: last.at,
        coverage,
        territories,
        historicalComparison: 'pending_validation',
        registryDigest: registry?.digest ?? null,
      };
    });
    if (!result)
      return reply.code(503).send({
        error: `Acervo ${environment} ainda não coletado. Execute collect:${environment}.`,
      });
    return result;
  });
  app.get(`/api/v1/${environment}/results`, async (request, reply) => {
    const q = z
      .object({
        office: z.enum(['president', 'governor']).default('president'),
        territory: z
          .string()
          .regex(/^[a-z]{2}$/)
          .default('br'),
        at: z
          .string()
          .datetime()
          .transform((value) => new Date(value).toISOString())
          .optional(),
      })
      .parse(request.query);
    if (q.office === 'governor' && ['br', 'zz'].includes(q.territory))
      return reply.code(400).send({ error: 'Governador exige UF doméstica' });
    const result = read((db) => {
      const rows = db
        .prepare(
          'SELECT payload FROM snapshot WHERE environment=? AND office=? AND territory_id=? AND (? IS NULL OR captured_at<=?) ORDER BY captured_at',
        )
        .all(environment, q.office, q.territory, q.at ?? null, q.at ?? null) as {
        payload: string;
      }[];
      const snapshots = rows.map((r) => JSON.parse(r.payload) as Snapshot);
      return {
        environment,
        basis: 'ea20',
        snapshots,
        status: snapshots.length ? 'captured' : 'not_loaded',
        historicalComparison: 'pending_validation',
      };
    });
    if (!result) return reply.code(503).send({ error: `Acervo ${environment} ainda não coletado` });
    return result;
  });
}
