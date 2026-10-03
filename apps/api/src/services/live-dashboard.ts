import { existsSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { Store } from '../db/store';
import { parseCatalog } from '../../../../packages/tse/src/index';
import type { Bootstrap, Territory } from '../../../../packages/domain/src/index';

/**
 * Main-dashboard API over a collection database (`/api/v1/live/<env>/…`), same shapes as the fixture
 * routes. Reads the collector's own SQLite (WAL: concurrent with the running collector); the only
 * write is the watchlist, which the live collector re-reads to start/stop municipal aggregates.
 * Never mixes environments and never falls back to fixture data.
 */
export function registerLiveDashboard(
  app: FastifyInstance,
  environment: 'official' | 'simulated',
  path: string,
) {
  const prefix = `/api/v1/live/${environment}`;
  let store: Store | null = null;
  let catalog: { digest: string; territories: Territory[] } | null = null;
  app.addHook('onClose', async () => store?.close());
  function open(reply: FastifyReply) {
    if (!store) {
      if (!existsSync(path)) {
        reply.code(503).send({
          error: `Acervo ${environment} ainda não coletado. Execute collect:${environment}:live.`,
        });
        return null;
      }
      store = new Store(path);
      const mixed = store.db
        .prepare(
          'SELECT 1 FROM snapshot WHERE environment<>? UNION SELECT 1 FROM zone_registry WHERE environment<>? LIMIT 1',
        )
        .get(environment, environment);
      if (mixed) {
        store.close();
        store = null;
        throw Error('Acervo contém ambiente incompatível');
      }
    }
    const body = store.db
      .prepare(
        "SELECT c.body_digest digest,b.compressed FROM collector_cache c JOIN collector_body b ON b.digest=c.body_digest WHERE c.job_key='bootstrap:ea12'",
      )
      .get() as { digest: string; compressed: Buffer } | undefined;
    if (!body) {
      reply.code(503).send({ error: 'Cadastro EA12 ainda não capturado neste acervo' });
      return null;
    }
    if (catalog?.digest !== body.digest)
      catalog = {
        digest: body.digest,
        territories: parseCatalog(
          JSON.parse(gunzipSync(body.compressed).toString('utf8')),
          environment,
        ),
      };
    return { store, territories: catalog.territories };
  }
  const querySchema = z.object({
    office: z.enum(['president', 'governor']).default('president'),
    territory: z.string().default('br'),
    at: z.string().datetime({ precision: 3 }).optional(),
  });
  function parameters(input: unknown, territories: Territory[]) {
    const query = querySchema.parse(input),
      selected = territories.find((t) => t.id === query.territory);
    if (!selected)
      throw new z.ZodError([
        { code: 'custom', path: ['territory'], message: 'Território desconhecido' },
      ]);
    if (query.office === 'governor' && ['br', 'exterior'].includes(selected.kind))
      throw new z.ZodError([
        { code: 'custom', path: ['office'], message: 'Governador exige UF ou município' },
      ]);
    return { ...query, selected };
  }
  app.get(`${prefix}/bootstrap`, async (_request, reply) => {
    const ctx = open(reply);
    if (!ctx) return reply;
    const lease = ctx.store.db.prepare('SELECT expires FROM collector_owner WHERE id=1').get() as
      | { expires: number }
      | undefined;
    const result: Bootstrap & { collectionRunning: boolean } = {
      environment,
      dataset:
        environment === 'official'
          ? 'Capturas do ambiente oficial do TSE'
          : 'Capturas do ambiente simulado do TSE — não são resultados oficiais',
      capabilities: {
        officialCollection: environment === 'official',
        cohort: true,
        historical: false,
      },
      territories: ctx.territories,
      watchlist: ctx.store.watchlist(environment),
      captures: ctx.store.captures(environment),
      fixtureStep: 0,
      fixtureSteps: 0,
      collectionRunning: Boolean(lease && lease.expires > Date.now()),
    };
    return result;
  });
  app.get(`${prefix}/latest`, async (request, reply) => {
    const ctx = open(reply);
    if (!ctx) return reply;
    const q = parameters(request.query, ctx.territories),
      snapshot = ctx.store.latest(environment, q.office, q.territory, q.at);
    const watching = ctx.store
      .watchlist(environment)
      .some((w) => w.territoryId === q.territory && w.enabled);
    return {
      environment,
      snapshot,
      monitoring: watching,
      status: snapshot
        ? snapshot.status
        : q.selected.kind === 'municipality' && !watching
          ? 'not_monitored'
          : 'not_loaded',
    };
  });
  app.get(`${prefix}/snapshots`, async (request, reply) => {
    const ctx = open(reply);
    if (!ctx) return reply;
    const q = parameters(request.query, ctx.territories);
    return ctx.store.snapshots(environment, q.office, q.territory, q.at);
  });
  app.get(`${prefix}/map`, async (request, reply) => {
    const ctx = open(reply);
    if (!ctx) return reply;
    const q = querySchema.parse(request.query);
    return ctx.territories
      .filter((t) => t.kind === 'uf' || (t.kind === 'municipality' && t.uf === q.territory))
      .map((t) => ({
        territoryId: t.id,
        snapshot:
          q.office === 'governor' && t.kind === 'exterior'
            ? null
            : ctx.store.latest(environment, q.office, t.id, q.at),
      }));
  });
  app.get(`${prefix}/sources/:id`, async (request, reply) => {
    const ctx = open(reply);
    if (!ctx) return reply;
    const { id } = z.object({ id: z.string() }).parse(request.params),
      snapshot = ctx.store.byId(environment, id);
    if (!snapshot) return reply.code(404).send({ error: 'Snapshot não encontrado' });
    return { snapshot, raw: JSON.parse(ctx.store.raw(snapshot.rawDigest)!) };
  });
  app.get(`${prefix}/watchlist`, async (_request, reply) => {
    const ctx = open(reply);
    if (!ctx) return reply;
    return ctx.store.watchlist(environment);
  });
  app.post(`${prefix}/watchlist`, async (request, reply) => {
    const ctx = open(reply);
    if (!ctx) return reply;
    const body = z
      .object({ territoryId: z.string(), collectBu: z.literal(false).optional() })
      .strict()
      .parse(request.body);
    const territory = ctx.territories.find((t) => t.id === body.territoryId);
    if (!territory || territory.kind !== 'municipality')
      return reply.code(400).send({ error: 'Selecione um município válido' });
    const enabled = ctx.store.watchlist(environment).filter((w) => w.enabled);
    if (enabled.length >= 20 && !enabled.some((w) => w.territoryId === territory.id))
      return reply.code(409).send({ error: 'Limite local de 20 municípios ativos' });
    ctx.store.setWatch(environment, territory.id, true);
    return ctx.store.watchlist(environment);
  });
  app.delete(`${prefix}/watchlist/:id`, async (request, reply) => {
    const ctx = open(reply);
    if (!ctx) return reply;
    const { id } = z.object({ id: z.string() }).parse(request.params);
    if (ctx.territories.find((t) => t.id === id)?.kind !== 'municipality')
      return reply.code(404).send({ error: 'Município não encontrado' });
    ctx.store.setWatch(environment, id, false);
    return ctx.store.watchlist(environment);
  });
}
