import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
const root = new URL('../packages/fixtures/', import.meta.url);
const config = JSON.parse(await readFile(new URL('simulado/ea11.json', root)));
const pl = config.pl.find((p) => p.cd === '17801');
const tokens = {
  base: 'https://resultados-sim.tse.jus.br/simulado',
  ambiente: 'simulado2026',
  ciclo: pl.c,
  cd_pleito: pl.cd,
  cd_eleicao: '21270',
  uf: 'ac',
};
function path(tp, values, filename) {
  return (
    config.arq
      .find((a) => a.tp === tp)
      .dir.replace(/<([^>]+)>/g, (_, k) => {
        const value = { ...tokens, ...values }[k];
        if (!value) throw Error(k);
        return value;
      }) +
    '/' +
    filename
  );
}
const observations = [];
async function download(file, url) {
  await delay(600);
  const capturedAt = new Date().toISOString();
  const r = await fetch(url, { signal: AbortSignal.timeout(30000), redirect: 'error' });
  const b = Buffer.from(await r.arrayBuffer());
  observations.push({
    file,
    url,
    status: r.status,
    capturedAt,
    bytes: b.length,
    sha256: createHash('sha256').update(b).digest('hex'),
  });
  console.log(file, r.status, b.length);
  if (!r.ok) return null; // no retry
  const j = JSON.parse(b.toString());
  const target = new URL(file, root);
  await mkdir(new URL('.', target), { recursive: true });
  await writeFile(target, b);
  return j;
}
const ea16 = await download('simulado/ea16-ac.json', path('cs', {}, 'ac-p017801-cs.json'));
if (ea16) {
  let chosen;
  for (const abr of ea16.abr)
    for (const mu of abr.mu)
      for (const zone of mu.zon) {
        const section = zone.sec.find((s) => s.da && s.ha && !s.nsp);
        if (section && !chosen) chosen = { municipio: mu.cd, zona: zone.cd, secao: section.ns };
      }
  if (chosen)
    await download(
      'simulado/ea18-ac.json',
      path(
        'aux',
        chosen,
        `p017801-ac-m${chosen.municipio}-z${chosen.zona}-s${chosen.secao}-aux.json`,
      ),
    );
}
await download('simulado/ea20-president-ac.json', path('u', {}, 'ac-c0001-e021270-u.json'));
await download(
  'simulado/ea20-president-ac01120.json',
  path('u', {}, 'ac01120-c0001-e021270-u.json'),
);
await download(
  'maps/br-ufs.geojson',
  'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=UF',
);
await download(
  'maps/ac-municipalities.geojson',
  'https://servicodados.ibge.gov.br/api/v3/malhas/estados/12?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio',
);
await writeFile(
  new URL('observation-extra.json', root),
  JSON.stringify(observations, null, 2) + '\n',
);
