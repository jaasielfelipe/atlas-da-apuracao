import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { csvRecords, importNominalHistory, reconcileZone } from './history';
import { rawDigest } from './index';
it('identidades documentadas correspondem aos IDs/nomes/números exatos das fontes', () => {
  const identities = JSON.parse(
    readFileSync('packages/fixtures/history/series-identities.json', 'utf8'),
  );
  for (const year of [2018, 2022]) {
    const manifest = JSON.parse(
      readFileSync(`packages/fixtures/history/${year}-manifest.json`, 'utf8'),
    );
    for (const series of ['bolsonaro', 'lula_haddad'])
      expect(manifest.candidates).toContainEqual(identities[year][series]);
  }
  const raw = readFileSync('packages/fixtures/zonal/official-ac01120-z0008.json', 'utf8'),
    j = JSON.parse(raw);
  expect(rawDigest(raw)).toBe(identities[2026].rawSha256);
  const candidates = j.carg
    .flatMap((c: any) => c.agr.flatMap((a: any) => a.par.flatMap((p: any) => p.cand)))
    .map((c: any) => ({ id: c.sqcand, number: c.n, name: c.nm }));
  for (const series of ['bolsonaro', 'lula_haddad'])
    expect(candidates).toContainEqual(identities[2026][series]);
  expect(j.ele).toBe(identities[2026].election);
});
it('importa recortes reais com todos os candidatos, IDs textuais e hashes', () => {
  for (const year of [2018, 2022] as const) {
    const bytes = readFileSync(`packages/fixtures/history/${year}-ac.csv`),
      manifest = JSON.parse(
        readFileSync(`packages/fixtures/history/${year}-manifest.json`, 'utf8'),
      );
    const result = importNominalHistory(bytes, year);
    expect(result.sha256).toBe(manifest.excerpt.sha256);
    expect(result.segments).toHaveLength(23);
    expect(
      result.segments.find((s) => s.municipality === '01120' && s.zone === '0008')?.candidates,
    ).toHaveLength(year === 2018 ? 13 : 11);
    expect(result.imported).toBe(year === 2018 ? 299 : 253);
    expect(() => importNominalHistory(bytes, year === 2018 ? 2022 : 2018)).toThrow('Ano');
  }
});
it('não certifica correspondência só por UF/ZE ou composição municipal igual', () => {
  expect(reconcileZone(['01120'], ['01120'], ['01120']).status).toBe('review');
  expect(reconcileZone(['01120'], ['01511'], ['01120']).status).toBe('uncertain');
  expect(reconcileZone(['01120', '01120'], ['01120'], ['01120']).status).toBe('unmatched');
  expect(
    reconcileZone(['01120'], ['01120'], ['01120'], {
      method: 'fixture',
      evidence: 'prova sintética',
      reorganizationsChecked: true,
    }).status,
  ).toBe('verified');
});
it('CSV respeita aspas, separadores, linhas e rejeita truncamento/duplicação', () => {
  expect([...csvRecords('"a;b";"x""y"\r\n"c\nd";1')]).toEqual([
    ['a;b', 'x"y'],
    ['c\nd', '1'],
  ]);
  expect(() => [...csvRecords('"ab')]).toThrow('truncado');
  const bytes = readFileSync('packages/fixtures/history/2018-ac.csv'),
    lines = bytes.toString('latin1').trimEnd().split('\r\n');
  expect(() =>
    importNominalHistory(Buffer.from([...lines, lines[1]].join('\r\n'), 'latin1'), 2018),
  ).toThrow('duplicada');
});
