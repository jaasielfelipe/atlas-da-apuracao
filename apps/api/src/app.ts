import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import { ZodError } from 'zod';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Store } from './db/store';
import { FixtureService } from './services/fixtures';
import { ZoneStore } from './db/zones';
import { compareZones } from '../../../packages/domain/src/zones';
import { registerDashboard, type DashboardSource } from './services/dashboard';
import { liveSource } from './services/live-source';

export async function createApp(
  options: {
    dbPath?: string;
    simulatedDbPath?: string;
    officialDbPath?: string;
    historyDbPath?: string;
    environment?: string;
    root?: string;
    logger?: boolean;
  } = {},
) {
  const root = options.root ?? process.cwd();
  const environment = options.environment ?? process.env.TSE_ENV ?? 'fixture';
  if (environment !== 'fixture')
    throw Error(
      'TSE_ENV só aceita fixture: dados reais são servidos em /live/<env> a partir do banco do coletor.',
    );
  const store = new Store(options.dbPath ?? resolve(root, 'data/atlas.sqlite'), root);
  const fixtures = new FixtureService(store, root);
  const app = Fastify({ logger: options.logger ?? false });
  const official = liveSource(
    'official',
    options.officialDbPath ?? resolve(root, 'data/official/collection.sqlite'),
    {
      historyPath: options.historyDbPath ?? resolve(root, 'data/history/atlas-history.sqlite'),
      root,
    },
  );
  const simulated = liveSource(
    'simulated',
    options.simulatedDbPath ?? resolve(root, 'data/simulated/collection.sqlite'),
  );
  app.addHook('onClose', async () => {
    store.close();
    official.close();
    simulated.close();
  });
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
  const fixture: DashboardSource = {
    environment: 'fixture',
    coverageBasis: 'synthetic',
    open: () => ({ store, territories: fixtures.territories }),
    bootstrap: () => ({
      dataset: fixtures.scenario.description,
      capabilities: { officialCollection: false, cohort: true, historical: false },
      fixtureStep: fixtures.step,
      fixtureSteps: fixtures.scenario.steps.length,
    }),
    watch: (_ctx, territory, enabled) => {
      if (enabled) fixtures.ingestTerritory(territory);
    },
    async comparison(_request, _reply, _ctx, q) {
      const at = q.at ?? store.captures('fixture').at(-1)!;
      const dataset = new ZoneStore(store).load('fixture', at);
      const scope = {
        uf: q.selected.uf ?? undefined,
        municipality: q.selected.tseCode ?? undefined,
      };
      const comparison = dataset ? compareZones(dataset, at, scope) : null;
      return {
        environment: 'fixture',
        status: comparison?.status ?? 'pending_validation',
        basis: 'historical_zone_cohort',
        unitKind: q.selected.kind === 'municipality' ? 'municipality_zone' : 'whole_zone',
        officialStatus: 'pending_validation',
        candidateStatus: 'synthetic_mapping',
        cohort: { enabled: true, status: 'fixture_only' },
        comparison,
        timeline: dataset
          ? store
              .captures('fixture')
              .filter((t) => t <= at)
              .map((t) => compareZones(dataset, t, scope))
          : [],
        method:
          'Cadastro e correspondência sintéticos explícitos; não provam identidade de seções, eleitores ou limites. Recorte de demonstração: 3 zonas no Acre, 6 segmentos. Exterior fora da fixture. Coleta e conciliação nacional oficial não validadas.',
      };
    },
  };
  app.get('/health', async () => ({
    ok: true,
    environment,
    database: 'sqlite-wal',
    version: '0.1.0',
    lastCapture: store.captures('fixture').at(-1) ?? null,
  }));
  registerDashboard(app, '/api/v1', fixture);
  registerDashboard(app, '/api/v1/live/official', official);
  registerDashboard(app, '/api/v1/live/simulated', simulated);
  app.post('/api/v1/fixture/advance', async () => ({ step: fixtures.advance() }));
  await app.register(fastifyStatic, {
    root: resolve(root, 'packages/fixtures/maps'),
    prefix: '/maps/',
    decorateReply: false,
  });
  const web = resolve(root, 'dist/web');
  if (existsSync(web)) {
    await app.register(fastifyStatic, { root: web, prefix: '/' });
    for (const page of ['/live/official', '/live/simulated'])
      app.get(page, async (_request, reply) => reply.sendFile('index.html'));
    // Former read-only archive pages now live in the main dashboard.
    app.get('/official', async (_request, reply) => reply.redirect('/live/official'));
    app.get('/simulated', async (_request, reply) => reply.redirect('/live/simulated'));
  }
  return { app, store, fixtures };
}
