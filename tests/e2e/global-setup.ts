import { mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { Store } from '../../apps/api/src/db/store';
import { NationalCollection, LIVE_PROFILE } from '../../apps/api/src/services/national';
import { cacheBootstrapCatalog } from '../../apps/api/src/services/test-helpers';
import { normalizeEA20 } from '../../packages/tse/src/index';
import { E2E_DIR, e2ePaths } from './paths';

const read = (p: string) => readFileSync(`packages/fixtures/${p}`, 'utf8');

/**
 * Deterministic live archives for the E2E run. Official: real captured EA11/EA12 and one zonal
 * segment, plus a modified simulated BR/AC body marked as official — synthetic transport evidence,
 * never an official observation. Simulated: a captured simulated BR snapshot and EA12.
 */
export default async function globalSetup() {
  const paths = e2ePaths();
  mkdirSync(E2E_DIR, { recursive: true });
  // Leftovers of earlier runs (the running server only holds this run's files).
  for (const file of readdirSync(E2E_DIR))
    if (!file.includes(paths.run))
      rmSync(join(E2E_DIR, file), { force: true, recursive: true, maxRetries: 3 });

  const observations = JSON.parse(read('zonal/observation.json'));
  const cat = observations.find((o: any) => o.file === 'official-ea12.json');
  const zone = observations.find((o: any) => o.file === 'official-ac01120-z0008.json');
  const ea12 = read('zonal/official-ea12.json');
  const official = new Store(paths.official);
  const collection = new NationalCollection(
    official,
    'official',
    {
      raw: read('official/ea11.json'),
      url: 'https://resultados.tse.jus.br/oficial/comum/config/ele-c.json',
      capturedAt: cat.capturedAt,
    },
    { raw: ea12, url: cat.url, capturedAt: cat.capturedAt },
    Date.now,
    LIVE_PROFILE,
  );
  cacheBootstrapCatalog(official, cat.url, ea12, cat.capturedAt);
  const jobs = [...collection.collector.queue.jobs.values()];
  collection.accept(
    read('zonal/official-ac01120-z0008.json'),
    jobs.find((j) => j.url === zone.url)!,
    zone.capturedAt,
  );
  for (const [file, suffix] of [
    ['simulado/ea20-president-br.json', '/br-c0001-e006257-u.json'],
    ['simulado/ea20-president-ac.json', '/ac-c0001-e006257-u.json'],
  ]) {
    const body = JSON.parse(read(file));
    body.f = 'o';
    body.ele = '6257';
    collection.accept(
      JSON.stringify(body),
      jobs.find((j) => j.kind === 'aggregate' && j.url.endsWith(suffix))!,
      '2026-10-04T21:00:00.000Z',
    );
  }
  official.close();

  const simulated = new Store(paths.simulated);
  const raw = read('simulado/ea20-president-br.json');
  const snapshot = normalizeEA20(JSON.parse(raw), {
    environment: 'simulated',
    electionId: '21270',
    office: 'president',
    territory: {
      id: 'br',
      kind: 'br',
      name: 'Brasil',
      uf: null,
      tseCode: null,
      ibgeCode: null,
      parentId: null,
    },
    sourceUrl:
      'https://resultados-sim.tse.jus.br/simulado/simulado2026/ele2026/21270/dados/br/br-c0001-e021270-u.json',
    capturedAt: '2026-10-03T18:00:00.000Z',
    raw,
  });
  simulated.insert(snapshot, raw);
  cacheBootstrapCatalog(
    simulated,
    'https://resultados-sim.tse.jus.br/simulado/simulado2026/ele2026/21270/config/br/br-e021270-i.json',
    read('simulado/ea12.json'),
    '2026-10-03T18:00:00.000Z',
  );
  simulated.close();
}
