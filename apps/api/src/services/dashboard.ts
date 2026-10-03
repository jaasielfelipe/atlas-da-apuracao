import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { Store } from '../db/store';
import type {
  Bootstrap,
  Environment,
  Office,
  Territory,
} from '../../../../packages/domain/src/index';

export type DashboardContext = { store: Store; territories: Territory[] };

/**
 * One environment behind the dashboard API. The fixture app, the official collection and the
 * simulated collection each provide one; routes and response shapes are shared.
 */
export interface DashboardSource {
  environment: Environment;
  /** Context, or a reason why this environment has nothing to serve yet (→ 503). */
  open(): DashboardContext | { unavailable: string };
  /** Environment-specific bootstrap fields (description, capabilities, collector state…). */
  bootstrap(
    ctx: DashboardContext,
  ): Omit<Bootstrap, 'environment' | 'territories' | 'watchlist' | 'captures'> &
    Record<string, unknown>;
  coverageBasis: 'synthetic' | 'ea20';
  /** Side effect of saving/removing a municipality (fixture: ingest its captures). */
  watch?(ctx: DashboardContext, territory: Territory, enabled: boolean): void;
  comparison(
    request: FastifyRequest,
    reply: FastifyReply,
    ctx: DashboardContext,
    query: { office: Office; selected: Territory; at?: string },
  ): Promise<unknown>;
}

const atSchema = z.string().datetime({ precision: 3 }).optional();
const querySchema = z.object({
  office: z.enum(['president', 'governor']).default('president'),
  territory: z.string().default('br'),
  at: atSchema,
});

/** Out-of-scope / unavailable comparison, same shape for every environment. */
export function comparisonUnavailable(
  environment: Environment,
  selected: Territory,
  office: Office,
  reason: string,
) {
  return {
    environment,
    status: 'unavailable',
    basis: 'historical_zone_cohort',
    unitKind: selected.kind === 'municipality' ? 'municipality_zone' : 'whole_zone',
    reason: office === 'governor' ? 'Comparação histórica de governador fora do escopo' : reason,
    candidateStatus: 'candidate_unresolved',
    comparison: null,
    timeline: [],
    cohort: {
      enabled: false,
      status: office === 'governor' ? 'out_of_scope' : 'pending_validation',
      reason: office === 'governor' ? 'Comparação histórica de governador fora do escopo' : reason,
    },
  };
}

export function registerDashboard(app: FastifyInstance, prefix: string, source: DashboardSource) {
  const { environment } = source;
  function open(reply: FastifyReply) {
    const ctx = source.open();
    if ('unavailable' in ctx) {
      reply.code(503).send({ error: ctx.unavailable });
      return null;
    }
    return ctx;
  }
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
    return {
      environment,
      ...source.bootstrap(ctx),
      territories: ctx.territories,
      watchlist: ctx.store.watchlist(environment),
      captures: ctx.store.captures(environment),
    };
  });
  app.get(`${prefix}/territories`, async (request, reply) => {
    const ctx = open(reply);
    if (!ctx) return reply;
    const {
      q = '',
      kind,
      uf,
    } = z
      .object({
        q: z.string().max(100).optional(),
        kind: z.string().optional(),
        uf: z.string().optional(),
      })
      .parse(request.query);
    const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    return ctx.territories
      .filter(
        (t) =>
          (!kind || t.kind === kind) &&
          (!uf || t.uf === uf) &&
          normalize(t.name).includes(normalize(q)),
      )
      .slice(0, 80);
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
    ctx.store.db.transaction(() => {
      ctx.store.setWatch(environment, territory.id, true);
      source.watch?.(ctx, territory, true);
    })();
    return ctx.store.watchlist(environment);
  });
  app.delete(`${prefix}/watchlist/:id`, async (request, reply) => {
    const ctx = open(reply);
    if (!ctx) return reply;
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const territory = ctx.territories.find((t) => t.id === id);
    if (territory?.kind !== 'municipality')
      return reply.code(404).send({ error: 'Município não encontrado' });
    ctx.store.setWatch(environment, id, false);
    source.watch?.(ctx, territory, false);
    return ctx.store.watchlist(environment);
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
  app.get(`${prefix}/coverage`, async (request, reply) => {
    const ctx = open(reply);
    if (!ctx) return reply;
    const q = parameters(request.query, ctx.territories),
      snapshot = ctx.store.latest(environment, q.office, q.territory, q.at);
    return {
      environment,
      basis: source.coverageBasis,
      universe: 'seções e eleitorado do território no snapshot',
      snapshotId: snapshot?.id ?? null,
      sections: snapshot?.sections ?? null,
      electorate: snapshot?.electorate ?? null,
    };
  });
  app.get(`${prefix}/map`, async (request, reply) => {
    const ctx = open(reply);
    if (!ctx) return reply;
    const q = querySchema.parse(request.query);
    return ctx.territories
      .filter((t) => t.kind === 'uf' || (t.kind === 'municipality' && t.uf === q.territory))
      .map((t) => ({
        territoryId: t.id,
        snapshot: ctx.store.latest(environment, q.office, t.id, q.at),
      }));
  });
  app.get(`${prefix}/comparison`, async (request, reply) => {
    const ctx = open(reply);
    if (!ctx) return reply;
    const q = parameters(request.query, ctx.territories);
    if (q.office === 'governor')
      return comparisonUnavailable(environment, q.selected, q.office, '');
    return source.comparison(request, reply, ctx, q);
  });
  app.get(`${prefix}/sources/:id`, async (request, reply) => {
    const ctx = open(reply);
    if (!ctx) return reply;
    const { id } = z.object({ id: z.string() }).parse(request.params),
      snapshot = ctx.store.byId(environment, id);
    if (!snapshot) return reply.code(404).send({ error: 'Snapshot não encontrado' });
    return { snapshot, raw: JSON.parse(ctx.store.raw(snapshot.rawDigest)!) };
  });
}
