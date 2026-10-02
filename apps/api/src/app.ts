import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { z, ZodError } from 'zod';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Bootstrap, Office } from '../../../packages/domain/src/index';
import { Store } from './db/store';
import { FixtureService } from './services/fixtures';

const atSchema = z.string().datetime({ precision: 3 }).optional();
const querySchema = z.object({
  office: z.enum(['president', 'governor']).default('president'),
  territory: z.string().default('br'),
  at: atSchema,
});
export async function createApp(
  options: { dbPath?: string; environment?: string; root?: string; logger?: boolean } = {},
) {
  const root = options.root ?? process.cwd();
  const environment = options.environment ?? process.env.TSE_ENV ?? 'fixture';
  if (environment !== 'fixture')
    throw Error(
      'Coleta official/simulated ainda não habilitada. Use TSE_ENV=fixture; contratos reais são verificados nos testes.',
    );
  const store = new Store(options.dbPath ?? resolve(root, 'data/atlas.sqlite'), root);
  const fixtures = new FixtureService(store, root);
  const app = Fastify({ logger: options.logger ?? false });
  app.addHook('onClose', async () => store.close());
  app.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin;
    if (origin && !/^http:\/\/127\.0\.0\.1:(5173|4173|3001)$/.test(origin))
      return reply.code(403).send({ error: 'Origem local obrigatória' });
  });
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError)
      return reply.code(400).send({ error: 'Parâmetros inválidos', details: error.issues });
    request.log.error(error);
    return reply.code(500).send({ error: 'Falha local; dados anteriores preservados' });
  });
  function findTerritory(id: string) {
    return fixtures.territories.find((t) => t.id === id);
  }
  function parameters(input: unknown) {
    const query = querySchema.parse(input),
      territory = findTerritory(query.territory);
    if (!territory)
      throw new ZodError([
        { code: 'custom', path: ['territory'], message: 'Território desconhecido' },
      ]);
    if (query.office === 'governor' && ['br', 'exterior'].includes(territory.kind))
      throw new ZodError([
        { code: 'custom', path: ['office'], message: 'Governador exige UF ou município' },
      ]);
    return { ...query, selected: territory };
  }
  app.get('/health', async () => ({
    ok: true,
    environment,
    database: 'sqlite-wal',
    version: '0.1.0',
    lastCapture: store.captures('fixture').at(-1) ?? null,
  }));
  app.get(
    '/api/v1/bootstrap',
    async (): Promise<Bootstrap> => ({
      environment: 'fixture',
      dataset: fixtures.scenario.description,
      capabilities: { officialCollection: false, cohort: false, historical: false },
      territories: fixtures.territories,
      watchlist: store.watchlist('fixture'),
      captures: store.captures('fixture'),
      fixtureStep: fixtures.step,
      fixtureSteps: fixtures.scenario.steps.length,
    }),
  );
  app.get('/api/v1/territories', async (request) => {
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
    const normalize = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    return fixtures.territories
      .filter(
        (t) =>
          (!kind || t.kind === kind) &&
          (!uf || t.uf === uf) &&
          normalize(t.name).includes(normalize(q)),
      )
      .slice(0, 80);
  });
  app.get('/api/v1/watchlist', async () => store.watchlist('fixture'));
  app.post('/api/v1/watchlist', async (request, reply) => {
    const body = z
      .object({ territoryId: z.string(), collectBu: z.literal(false).optional() })
      .strict()
      .parse(request.body);
    const territory = findTerritory(body.territoryId);
    if (!territory || territory.kind !== 'municipality')
      return reply.code(400).send({ error: 'Selecione um município válido' });
    const enabled = store.watchlist('fixture').filter((w) => w.enabled);
    if (enabled.length >= 20 && !enabled.some((w) => w.territoryId === territory.id))
      return reply.code(409).send({ error: 'Limite local de 20 municípios ativos' });
    store.db.transaction(() => {
      store.setWatch('fixture', territory.id, true);
      fixtures.ingestTerritory(territory);
    })();
    return store.watchlist('fixture');
  });
  app.delete('/api/v1/watchlist/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    if (findTerritory(id)?.kind !== 'municipality')
      return reply.code(404).send({ error: 'Município não encontrado' });
    store.setWatch('fixture', id, false);
    return store.watchlist('fixture');
  });
  app.get('/api/v1/latest', async (request) => {
    const q = parameters(request.query),
      snapshot = store.latest('fixture', q.office, q.territory, q.at);
    const watching = store
      .watchlist('fixture')
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
  app.get('/api/v1/snapshots', async (request) => {
    const q = parameters(request.query);
    return store.snapshots('fixture', q.office, q.territory, q.at);
  });
  app.get('/api/v1/coverage', async (request) => {
    const q = parameters(request.query),
      snapshot = store.latest('fixture', q.office, q.territory, q.at);
    return {
      environment,
      basis: 'synthetic',
      universe: 'seções e eleitorado do território no snapshot',
      snapshotId: snapshot?.id ?? null,
      sections: snapshot?.sections ?? null,
      electorate: snapshot?.electorate ?? null,
    };
  });
  app.get('/api/v1/map', async (request) => {
    const q = querySchema.parse(request.query);
    const territories = fixtures.territories.filter(
      (t) => t.kind === 'uf' || (t.kind === 'municipality' && t.uf === q.territory),
    );
    return territories.map((t) => ({
      territoryId: t.id,
      snapshot: store.latest('fixture', q.office, t.id, q.at),
    }));
  });
  app.get('/api/v1/comparison', async (request) => {
    const q = parameters(request.query);
    return {
      environment,
      status: 'unavailable',
      basis: 'historical_zone_cohort',
      unitKind: q.selected.kind === 'municipality' ? 'municipality_zone' : 'whole_zone',
      reason:
        q.office === 'governor'
          ? 'Comparação histórica de governador fora do escopo'
          : 'Histórico 2018/2022 não importado e identidades oficiais 2026 não resolvidas',
      candidateStatus: 'candidate_unresolved',
      cohort: {
        enabled: false,
        status: q.office === 'governor' ? 'out_of_scope' : 'pending_validation',
        reason:
          q.office === 'governor'
            ? 'Comparação histórica de governador fora do escopo'
            : 'EA20 município–zona, cadastro completo e conciliação 2018/2022 pendentes; coleta zonal nacional não validada',
      },
    };
  });
  app.get('/api/v1/sources/:id', async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params),
      snapshot = store.byId('fixture', id);
    if (!snapshot) return reply.code(404).send({ error: 'Snapshot não encontrado' });
    return { snapshot, raw: JSON.parse(store.raw(snapshot.rawDigest)!) };
  });
  app.post('/api/v1/fixture/advance', async () => ({ step: fixtures.advance() }));
  await app.register(fastifyStatic, {
    root: resolve(root, 'packages/fixtures/maps'),
    prefix: '/maps/',
    decorateReply: false,
  });
  const web = resolve(root, 'dist/web');
  if (existsSync(web)) await app.register(fastifyStatic, { root: web, prefix: '/' });
  return { app, store, fixtures };
}
