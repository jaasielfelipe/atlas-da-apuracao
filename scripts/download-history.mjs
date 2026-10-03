import { mkdir, writeFile } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
await mkdir('data/history', { recursive: true });
for (const year of [2018, 2022]) {
  const url = `https://cdn.tse.jus.br/estatistica/sead/odsele/votacao_candidato_munzona/votacao_candidato_munzona_${year}.zip`;
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(180000) });
  if (!response.ok) throw Error(`${year}: HTTP ${response.status}; sem repetição automática`);
  const hash = createHash('sha256');
  let bytes = 0;
  const stream = Readable.fromWeb(response.body);
  stream.on('data', (chunk) => {
    hash.update(chunk);
    bytes += chunk.length;
  });
  await pipeline(stream, createWriteStream(`data/history/${year}.zip`));
  const evidence = {
    year,
    url,
    capturedAt: new Date().toISOString(),
    bytes,
    sha256: hash.digest('hex'),
    etag: response.headers.get('etag'),
  };
  await writeFile(`data/history/${year}-download.json`, JSON.stringify(evidence, null, 2));
  console.log(evidence);
}
