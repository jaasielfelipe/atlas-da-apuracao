// IBGE municipal meshes (API v3, qualidade=minima), one request per UF, sequential, no retries.
// Same source/format as the original ac-municipalities.geojson (property `codarea` = IBGE code).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const UFS =
  'ac,al,am,ap,ba,ce,df,es,go,ma,mg,ms,mt,pa,pb,pe,pi,pr,rj,rn,ro,rr,rs,sc,se,sp,to'.split(',');
const dir = 'packages/fixtures/maps';
const manifestPath = `${dir}/municipalities-manifest.json`;
const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
for (const uf of UFS) {
  const file = `${dir}/${uf}-municipalities.geojson`;
  if (existsSync(file) && manifest[uf]) continue;
  const url = `https://servicodados.ibge.gov.br/api/v3/malhas/estados/${uf.toUpperCase()}?formato=application/vnd.geo%2Bjson&intrarregiao=municipio&qualidade=minima`;
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (response.status !== 200) throw Error(`${uf}: HTTP ${response.status}`);
  const raw = await response.text();
  const body = JSON.parse(raw);
  const codes = body.features.map((f) => f.properties.codarea);
  if (!codes.length || codes.some((c) => typeof c !== 'string' || !/^\d{7}$/.test(c)))
    throw Error(`${uf}: malha sem codarea IBGE de 7 dígitos`);
  if (existsSync(file) && readFileSync(file, 'utf8') !== raw)
    throw Error(`${uf}: arquivo local difere da fonte; não sobrescrever`);
  writeFileSync(file, raw);
  manifest[uf] = {
    url,
    capturedAt: new Date().toISOString(),
    sha256: createHash('sha256').update(raw).digest('hex'),
    features: codes.length,
  };
  console.log(uf, codes.length, raw.length);
}
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
