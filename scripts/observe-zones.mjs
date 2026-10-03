import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

// Opt-in observation only: sequential, 600 ms spacing, no retries or enumeration by 404.
const root = new URL('../packages/fixtures/', import.meta.url);
const output = new URL('zonal/', root);
await mkdir(output, { recursive: true });
const records = [];
function path(config, environment, type, filename, uf = 'br') {
  const official = environment === 'official';
  const pleito = config.pl.find((p) => p.cd === (official ? '3220' : '17801'));
  if (!pleito || config.f !== (official ? 'o' : 's')) throw Error('Configuração incompatível');
  const election = pleito.e.find(
    (e) => e.t === '1' && e.abr.some((a) => a.cp.some((c) => c.cd === '1')),
  );
  const values = {
    base: official ? 'https://resultados.tse.jus.br' : 'https://resultados-sim.tse.jus.br/simulado',
    ambiente: official ? 'oficial' : 'simulado2026',
    ciclo: pleito.c,
    cd_eleicao: election.cd,
    uf,
  };
  const directory = config.arq
    .find((a) => a.tp === type)
    .dir.replace(/<([^>]+)>/g, (_, k) => {
      if (!values[k]) throw Error(`Token desconhecido: ${k}`);
      return values[k];
    });
  return `${directory}/${filename(election.cd.padStart(6, '0'))}`;
}
async function capture(file, url, environment) {
  await delay(600);
  const capturedAt = new Date().toISOString();
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(20000), redirect: 'error' });
    const bytes = Buffer.from(await r.arrayBuffer());
    const record = {
      file,
      url,
      environment,
      capturedAt,
      status: r.status,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      etag: r.headers.get('etag'),
      lastModified: r.headers.get('last-modified'),
    };
    records.push(record);
    console.log(file, r.status, bytes.length);
    if (!r.ok) return null;
    const json = JSON.parse(bytes.toString());
    await writeFile(new URL(file, output), bytes);
    return json;
  } catch (error) {
    records.push({ file, url, environment, capturedAt, error: String(error) });
    console.log(file, String(error));
    return null;
  } finally {
    await writeFile(new URL('observation.json', output), JSON.stringify(records, null, 2) + '\n');
  }
}
const simulated = JSON.parse(await readFile(new URL('simulado/ea11.json', root)));
const catalog = JSON.parse(await readFile(new URL('simulado/ea12.json', root)));
for (const m of catalog.abr.find((a) => a.cd === 'ac').mu.filter((m) => m.z.includes('0008'))) {
  const j = await capture(
    `sim-ac${m.cd}-z0008.json`,
    path(simulated, 'simulated', 'u', (e) => `ac${m.cd}-z0008-c0001-e${e}-u.json`, 'ac'),
    'simulated',
  );
  if (j)
    console.log(JSON.stringify({ tpabr: j.tpabr, cdabr: j.cdabr, s: j.s, vv: j.v?.vv, f: j.f }));
}
const exceptional = catalog.abr.find((a) => a.cd === 'ba').mu.find((m) => m.nm === 'IBIRAPUÃ');
if (exceptional) {
  await capture(
    `sim-ba${exceptional.cd}-z0153.json`,
    path(simulated, 'simulated', 'u', (e) => `ba${exceptional.cd}-z0153-c0001-e${e}-u.json`, 'ba'),
    'simulated',
  );
}
const official = JSON.parse(await readFile(new URL('official/ea11.json', root)));
const officialCatalog = await capture(
  'official-ea12.json',
  path(official, 'official', 'cm', (e) => `mun-e${e}-cm.json`),
  'official',
);
if (officialCatalog) {
  const m = officialCatalog.abr.find((a) => a.cd === 'ac')?.mu.find((m) => m.cd === '01120');
  if (m?.z.includes('0008'))
    await capture(
      'official-ac01120-z0008.json',
      path(official, 'official', 'u', (e) => `ac01120-z0008-c0001-e${e}-u.json`, 'ac'),
      'official',
    );
}
