// Opt-in, bounded contract observation. Never runs from the application.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const root = new URL('../packages/fixtures/', import.meta.url);
const sim = 'https://resultados-sim.tse.jus.br/simulado/simulado2026';
const targets = [
  ['official/ea11.json', 'https://resultados.tse.jus.br/oficial/comum/config/ele-c.json'],
  ['simulado/ea11.json', `${sim}/comum/config/ele-c.json`],
  ['simulado/ea12.json', `${sim}/ele2026/21270/config/mun-e021270-cm.json`],
  ['simulado/ea14.json', `${sim}/ele2026/21270/dados/br/br-e021270-ab.json`],
  ['simulado/ea15-ac.json', `${sim}/ele2026/21270/dados/ac/ac-e021270-ab.json`],
  ['simulado/ea20-president-br.json', `${sim}/ele2026/21270/dados/br/br-c0001-e021270-u.json`],
  ['simulado/ea20-governor-ac.json', `${sim}/ele2026/21272/dados/ac/ac-c0003-e021272-u.json`],
];
const manifest = [];
for (const [file, url] of targets) {
  await delay(600);
  const capturedAt = new Date().toISOString();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000), redirect: 'error' });
    const bytes = Buffer.from(await response.arrayBuffer());
    const entry = {
      file,
      url,
      capturedAt,
      status: response.status,
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
    };
    if (response.ok) {
      JSON.parse(bytes.toString());
      const path = new URL(file, root);
      await mkdir(new URL('.', path), { recursive: true });
      await writeFile(path, bytes);
    }
    manifest.push(entry);
    console.log(file, response.status, bytes.length);
    if ([403, 429].includes(response.status)) break;
  } catch (error) {
    manifest.push({ file, url, capturedAt, error: String(error) });
    console.log(file, String(error));
  }
}
await mkdir(root, { recursive: true });
await writeFile(new URL('observation.json', root), JSON.stringify(manifest, null, 2) + '\n');
