import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { importNominalHistory, csvRecords, reconcileZone } from '../packages/tse/src/history';
mkdirSync('packages/fixtures/history', { recursive: true });
for (const year of [2018, 2022] as const) {
  const bytes = readFileSync(`data/history/${year}-BR.csv`),
    result = importNominalHistory(bytes, year);
  const text = new TextDecoder('windows-1252').decode(bytes),
    records = [...csvRecords(text)],
    header = records[0];
  const uf = header.indexOf('SG_UF'),
    turn = header.indexOf('NR_TURNO');
  const selected = [header, ...records.slice(1).filter((r) => r[uf] === 'AC' && r[turn] === '1')];
  // Preserve original bytes for selected complete CSV records using the Latin-1 range observed in this excerpt.
  const excerpt = Buffer.from(
    selected.map((r) => r.map((v) => '"' + v.replaceAll('"', '""') + '"').join(';')).join('\r\n') +
      '\r\n',
    'latin1',
  );
  writeFileSync(`packages/fixtures/history/${year}-ac.csv`, excerpt);
  const candidates = [
    ...new Map(
      result.segments.flatMap((s) =>
        s.candidates.map((c) => [c.id, { id: c.id, number: c.number, name: c.name }] as const),
      ),
    ).values(),
  ];
  const report = {
    ...result,
    segments: result.segments.length,
    valid: result.segments.reduce((n, s) => n + s.valid, 0),
    candidates,
    download: JSON.parse(readFileSync(`data/history/${year}-download.json`, 'utf8')),
    excerpt: {
      file: `${year}-ac.csv`,
      sha256: createHash('sha256').update(excerpt).digest('hex'),
      rows: selected.length - 1,
      transformation:
        'AC, turno 1; quoting uniforme; bytes Windows-1252/Latin-1 no recorte observado. Originais integrais em data/history.',
    },
  };
  writeFileSync(`packages/fixtures/history/${year}-manifest.json`, JSON.stringify(report, null, 2));
  console.log(report);
}
