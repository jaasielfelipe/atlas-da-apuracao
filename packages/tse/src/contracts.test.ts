import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import {
  discoverElection,
  resolveTsePath,
  normalizeEA20,
  parseCatalog,
  parseTracking,
  parseSections,
  parseAuxiliary,
  digest,
  validateOrigin,
} from './index';
import type { Territory } from '../../domain/src/index';
const fixture = (name: string) =>
  JSON.parse(readFileSync(`packages/fixtures/${name}.json`, 'utf8'));
const br: Territory = {
  id: 'br',
  kind: 'br',
  name: 'Brasil',
  uf: null,
  tseCode: null,
  ibgeCode: null,
  parentId: null,
};
const context = {
  environment: 'fixture' as const,
  electionId: '21270',
  office: 'president' as const,
  territory: br,
  sourceUrl: 'fixture:simulado/ea20-president-br.json',
  capturedAt: '2026-10-02T18:00:00.000Z',
};
const federal = () => fixture('simulado/ea20-president-br');
describe('Etapa 0: arquivos capturados do TSE', () => {
  it('preserva os bytes de todas as capturas conforme os manifests', () => {
    const observations = [...fixture('observation'), ...fixture('observation-extra')];
    for (const entry of observations) {
      expect(entry.status).toBe(200);
      const bytes = readFileSync(`packages/fixtures/${entry.file}`);
      expect(bytes.length).toBe(entry.bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
    }
  });
  it('descobre pleito e cargos oficiais por EA11, sem misturar ciclos', () => {
    for (const [office, id] of [
      ['president', '6257'],
      ['governor', '6259'],
    ] as const) {
      const c = discoverElection(fixture('official/ea11'), 'official', office);
      expect(c).toMatchObject({ pleitoId: '3220', cycle: 'ele2026', electionId: id, round: '1' });
    }
    expect(() => discoverElection(fixture('simulado/ea11'), 'official', 'president')).toThrow(
      /Fase/,
    );
  });
  it('deriva caminhos dos diretórios reais, preservando padding', () => {
    const c = discoverElection(fixture('simulado/ea11'), 'simulated', 'president');
    const base = 'https://resultados-sim.tse.jus.br/simulado/simulado2026/ele2026';
    expect(resolveTsePath('EA20', c)).toBe(`${base}/21270/dados/br/br-c0001-e021270-u.json`);
    expect(resolveTsePath('EA12', c)).toBe(`${base}/21270/config/mun-e021270-cm.json`);
    expect(resolveTsePath('EA14', c)).toBe(`${base}/21270/dados/br/br-e021270-ab.json`);
    expect(resolveTsePath('EA15', { ...c, uf: 'ac' })).toBe(
      `${base}/21270/dados/ac/ac-e021270-ab.json`,
    );
    expect(resolveTsePath('EA20', { ...c, uf: 'ac', municipality: '00035' })).toContain(
      'ac00035-c0001',
    );
    expect(resolveTsePath('EA16', { ...c, uf: 'ac' })).toBe(
      `${base}/arquivo-urna/17801/config/ac/ac-p017801-cs.json`,
    );
    expect(
      resolveTsePath('EA18', {
        ...c,
        uf: 'ac',
        municipality: '01120',
        zone: '0008',
        section: '0001',
      }),
    ).toBe(
      `${base}/arquivo-urna/17801/dados/ac/01120/0008/0001/p017801-ac-m01120-z0008-s0001-aux.json`,
    );
    expect(() => resolveTsePath('EA20', { ...c, uf: '../' })).toThrow();
    const changed = structuredClone(c);
    changed.config.arq.find((a) => a.tp === 'u')!.dir += '/new';
    expect(resolveTsePath('EA20', changed)).toContain('/new/br-c0001');
  });
  it('valida votos reais do simulado e destinações sem usar pvap como válidos', () => {
    const s = normalizeEA20(federal(), context);
    expect(s.votes).toMatchObject({ valid: 100982116, toCandidates: 120704576 });
    expect(
      s.candidates.filter((c) => c.destination !== 'Válido').every((c) => c.validShare === null),
    ).toBe(true);
    expect(
      s.candidates
        .filter((c) => c.destination === 'Válido')
        .reduce((sum, c) => sum + c.countedVotes!, 0),
    ).toBe(s.votes.valid);
    expect(s.sourceGeneratedAt).toBe('2026-09-29T19:29:12.000Z');
    expect(s.sourceTotalizedAt).toBe('2026-09-29T19:28:52.000Z');
    expect(s.phase).toBe('s');
  });
  it('valida governador AC e presidente municipal com tpabr=mu', () => {
    const ac = { ...br, id: 'ac', kind: 'uf' as const, name: 'Acre', uf: 'ac' };
    expect(
      normalizeEA20(fixture('simulado/ea20-governor-ac'), {
        ...context,
        electionId: '21272',
        office: 'governor',
        territory: ac,
      }).office,
    ).toBe('governor');
    expect(
      normalizeEA20(fixture('simulado/ea20-president-ac01120'), {
        ...context,
        territory: { ...ac, id: 'ac:01120', kind: 'municipality', tseCode: '01120' },
      }).territoryId,
    ).toBe('ac:01120');
  });
  it('isola fase, eleição, turno, cargo, abrangência e origem', () => {
    expect(() =>
      normalizeEA20(federal(), {
        ...context,
        environment: 'official',
        sourceUrl: 'https://resultados.tse.jus.br/oficial/test.json',
      }),
    ).toThrow(/Fase/);
    for (const patch of [{ ele: '6257' }, { t: '2' }, { cdabr: 'ac' }, { tpabr: 'uf' }])
      expect(() => normalizeEA20({ ...federal(), ...patch }, context)).toThrow();
    expect(() => normalizeEA20(federal(), { ...context, office: 'governor' })).toThrow();
    expect(() =>
      validateOrigin('https://resultados.tse.jus.br.evil.test/oficial/a', 'official'),
    ).toThrow();
  });
  it('dv=n é indisponibilidade de votação, não zero', () => {
    const s = normalizeEA20({ ...federal(), dv: 'n' }, context);
    expect(s.status).toBe('not_published');
    expect(s.votes.valid).toBeNull();
    expect(s.candidates.every((c) => c.countedVotes === null && c.validShare === null)).toBe(true);
  });
  it('zero legítimo preservado; categorias ou contadores inválidos rejeitados', () => {
    const j = federal();
    for (const k of Object.keys(j.v)) if (/^\d+$/.test(j.v[k])) j.v[k] = '0';
    for (const a of j.carg[0].agr) for (const p of a.par) for (const c of p.cand ?? []) c.vap = '0';
    expect(normalizeEA20(j, context).votes.valid).toBe(0);
    expect(normalizeEA20(j, context).candidates.every((c) => c.validShare === null)).toBe(true);
    j.s.st = '9999999';
    expect(() => normalizeEA20(j, context)).toThrow(/cobertura/);
    const broken = federal();
    broken.v.vv = '1';
    expect(() => normalizeEA20(broken, context)).toThrow(/votos/);
    const unsafe = federal();
    unsafe.v.vv = '9007199254740992';
    expect(() => normalizeEA20(unsafe, context)).toThrow();
  });
  it('catálogo mantém município 01120 e IBGE, exclui municípios fictícios no DF/ZZ', () => {
    const catalog = parseCatalog(fixture('simulado/ea12'), 'simulated');
    expect(catalog.find((t) => t.id === 'ac:01120')).toMatchObject({
      ibgeCode: '1200013',
      tseCode: '01120',
    });
    expect(catalog.filter((t) => t.kind === 'uf')).toHaveLength(27);
    expect(catalog.some((t) => t.kind === 'municipality' && ['df', 'zz'].includes(t.uf!))).toBe(
      false,
    );
  });
  it('EA14/15 são pistas independentes, EA16/18 não comprovam BU disponível', () => {
    expect(
      parseTracking(fixture('simulado/ea14'), 'simulated', '21270', 'EA14').length,
    ).toBeGreaterThanOrEqual(27);
    expect(parseTracking(fixture('simulado/ea15-ac'), 'simulated', '21270', 'EA15')).toHaveLength(
      23,
    ); // 22 municípios + UF
    expect(parseSections(fixture('simulado/ea16-ac'), 'simulated', '17801').abr[0].cd).toBe('ac');
    expect(parseAuxiliary(fixture('simulado/ea18-ac'), 'simulated').availableFiles).toEqual([]);
  });
  it('digest independe da ordem de propriedades', () =>
    expect(digest({ a: 1, b: 2 })).toBe(digest({ b: 2, a: 1 })));
});
