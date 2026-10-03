import type { Environment } from './index';

export const years = [2018, 2022, 2026] as const;
export type Year = (typeof years)[number];
export const classes = ['bolsonaro', 'lula_haddad', 'outros', 'empate'] as const;
export type Leader = (typeof classes)[number];
export type ZoneSegment = { uf: string; municipality: string; zone: string };
export const segmentId = (s: ZoneSegment) => `${s.uf}:${s.municipality}:${s.zone}`;
export const wholeZoneId = (s: ZoneSegment) => `${s.uf}:${s.zone}`;
export type ZoneResult = ZoneSegment & {
  id: string;
  environment: Environment;
  year: Year;
  election: string;
  round: '1';
  capturedAt: string;
  sourceUrl: string;
  sourceDigest: string;
  status: 'complete' | 'partial' | 'needs_review';
  basis?: 'ea20' | 'historical_final';
  total: number | null;
  totalized: number | null;
  notTotalized: number | null;
  valid: number | null;
  candidates: { id: string; votes: number }[];
};
export type ZoneMatch = {
  id: string;
  current: string;
  historical2018: string;
  historical2022: string;
  status: 'verified' | 'uncertain' | 'unmatched' | 'review';
  capturedAt: string;
  method: string;
  evidence: string;
  registryDigest: string;
};
export type ZoneDataset = {
  environment: Environment;
  capturedAt: string;
  registryDigest: string;
  registryComplete: boolean;
  segments: ZoneSegment[];
  results: ZoneResult[];
  matches: ZoneMatch[];
  mappings: Record<Year, { bolsonaro: string; lula_haddad: string }>;
};
const counts = () => Object.fromEntries(classes.map((c) => [c, 0])) as Record<Leader, number>;
const safe = (n: number) => Number.isSafeInteger(n) && n >= 0;
export function validResult(r: ZoneResult) {
  return (
    r.round === '1' &&
    r.status === 'complete' &&
    (r.basis === 'historical_final'
      ? (r.year === 2018 || r.year === 2022) &&
        r.total === null &&
        r.totalized === null &&
        r.notTotalized === null
      : r.total !== null &&
        safe(r.total) &&
        r.total > 0 &&
        r.totalized === r.total &&
        r.notTotalized === 0) &&
    r.valid !== null &&
    safe(r.valid) &&
    r.valid > 0 &&
    r.candidates.length > 0 &&
    new Set(r.candidates.map((c) => c.id)).size === r.candidates.length &&
    r.candidates.every((c) => c.id.length > 0 && safe(c.votes)) &&
    r.candidates.reduce((n, c) => n + c.votes, 0) === r.valid
  );
}
export function leader(
  candidates: { id: string; votes: number }[],
  mapping: ZoneDataset['mappings'][Year],
): Leader | null {
  if (
    !candidates.length ||
    candidates.some((c) => !safe(c.votes)) ||
    new Set(candidates.map((c) => c.id)).size !== candidates.length
  )
    return null;
  const max = Math.max(...candidates.map((c) => c.votes));
  if (max <= 0) return null;
  const top = candidates.filter((c) => c.votes === max);
  if (top.length > 1) return 'empate';
  return top[0].id === mapping.bolsonaro
    ? 'bolsonaro'
    : top[0].id === mapping.lula_haddad
      ? 'lula_haddad'
      : 'outros';
}
function aggregate(rows: ZoneResult[], mapping: ZoneDataset['mappings'][Year]) {
  const votes = new Map<string, number>();
  for (const r of rows)
    for (const c of r.candidates) votes.set(c.id, (votes.get(c.id) ?? 0) + c.votes);
  const valid = rows.reduce((n, r) => n + r.valid!, 0);
  if (
    !safe(valid) ||
    !mapping?.bolsonaro ||
    !mapping.lula_haddad ||
    mapping.bolsonaro === mapping.lula_haddad ||
    !votes.has(mapping.bolsonaro) ||
    !votes.has(mapping.lula_haddad)
  )
    return null;
  const first = leader(
    [...votes].map(([id, votes]) => ({ id, votes })),
    mapping,
  );
  return first
    ? {
        valid,
        bolsonaro: votes.get(mapping.bolsonaro)!,
        lula_haddad: votes.get(mapping.lula_haddad)!,
        leader: first,
      }
    : null;
}
export function compareZones(
  dataset: ZoneDataset,
  at: string,
  scope: { uf?: string; municipality?: string } = {},
) {
  if (!Number.isFinite(Date.parse(at)) || new Date(at).toISOString() !== at)
    throw Error('Instante inválido');
  if (scope.municipality && !scope.uf) throw Error('Município exige UF');
  const unitKind = scope.municipality ? ('municipality_zone' as const) : ('whole_zone' as const);
  const registryReady = dataset.registryComplete && dataset.capturedAt <= at;
  const units = new Map<string, ZoneSegment[]>();
  const unique = new Set<string>();
  for (const s of registryReady ? dataset.segments : []) {
    if (!/^[a-z]{2}$/.test(s.uf) || !/^\d{5}$/.test(s.municipality) || !/^\d{4}$/.test(s.zone))
      throw Error('Identificador territorial inválido');
    if (unique.has(segmentId(s))) throw Error('Cadastro duplicado');
    unique.add(segmentId(s));
    if (
      (!scope.uf || s.uf === scope.uf) &&
      (!scope.municipality || s.municipality === scope.municipality)
    ) {
      const key = unitKind === 'whole_zone' ? wholeZoneId(s) : segmentId(s);
      units.set(key, [...(units.get(key) ?? []), s]);
    }
  }
  const latest = new Map<string, ZoneResult>();
  const elections = new Map<Year, string>();
  for (const r of dataset.results) {
    if (r.environment !== dataset.environment || r.capturedAt > at) continue;
    if (elections.has(r.year) && elections.get(r.year) !== r.election)
      throw Error('Eleições históricas misturadas');
    elections.set(r.year, r.election);
    const key = `${r.year}:${segmentId(r)}`,
      prev = latest.get(key);
    if (prev?.capturedAt === r.capturedAt && prev.id !== r.id)
      throw Error('Versões simultâneas ambíguas');
    if (!prev || prev.capturedAt < r.capturedAt) latest.set(key, r);
  }
  const matches = new Map<string, ZoneMatch>();
  for (const m of dataset.matches.filter((m) => m.capturedAt <= at)) {
    const prev = matches.get(m.current);
    if (prev?.capturedAt === m.capturedAt && prev.id !== m.id) throw Error('Conciliação ambígua');
    if (!prev || prev.capturedAt < m.capturedAt) matches.set(m.current, m);
  }
  const historicalUse = new Map<string, number>();
  for (const m of matches.values())
    for (const [year, key] of [
      [2018, m.historical2018],
      [2022, m.historical2022],
    ] as const) {
      const k = `${year}:${key}`;
      historicalUse.set(k, (historicalUse.get(k) ?? 0) + 1);
    }
  const rows: {
    key: string;
    segments: string[];
    status: string;
    observedAt: string | null;
    values: Record<Year, NonNullable<ReturnType<typeof aggregate>>> | null;
  }[] = [];
  let completed = 0;
  for (const [key, segments] of units) {
    let reason = registryReady ? '' : 'pending_registry';
    const current = segments.map((s) => latest.get(`2026:${segmentId(s)}`));
    const complete = current.every((r) => r && validResult(r));
    if (complete && registryReady) completed++;
    if (!reason && !complete) reason = 'incomplete';
    const histories: Record<2018 | 2022, ZoneResult[]> = { 2018: [], 2022: [] };
    for (const s of segments) {
      const m = matches.get(segmentId(s));
      if (
        !m ||
        m.status !== 'verified' ||
        !m.evidence ||
        !m.method ||
        m.registryDigest !== dataset.registryDigest
      ) {
        reason ||= m?.status ?? 'unmatched';
        continue;
      }
      for (const year of [2018, 2022] as const) {
        const historical = year === 2018 ? m.historical2018 : m.historical2022;
        const r = latest.get(`${year}:${historical}`);
        if (historicalUse.get(`${year}:${historical}`) !== 1) reason ||= 'duplicate_match';
        if (!r || !validResult(r)) reason ||= 'historical_unavailable';
        else histories[year].push(r);
      }
    }
    const values = {} as Record<Year, NonNullable<ReturnType<typeof aggregate>>>;
    if (!reason)
      for (const year of years) {
        const value = aggregate(
          year === 2026 ? (current as ZoneResult[]) : histories[year],
          dataset.mappings[year],
        );
        if (!value) reason = 'candidate_unresolved';
        else values[year] = value;
      }
    rows.push({
      key,
      segments: segments.map(segmentId),
      status: reason || 'included',
      observedAt: current.every((r) => r)
        ? current
            .map((r) => r!.capturedAt)
            .sort()
            .at(-1)!
        : null,
      values: reason ? null : values,
    });
  }
  const cohort = rows.filter((r) => r.values);
  const leadership = { 2018: counts(), 2022: counts(), 2026: counts() };
  const shares = Object.fromEntries(
    years.map((year) => {
      const valid = cohort.reduce((n, r) => n + r.values![year].valid, 0);
      const b = cohort.reduce((n, r) => n + r.values![year].bolsonaro, 0);
      const l = cohort.reduce((n, r) => n + r.values![year].lula_haddad, 0);
      for (const r of cohort) leadership[year][r.values![year].leader]++;
      return [
        year,
        { valid, bolsonaro: valid ? b / valid : null, lula_haddad: valid ? l / valid : null },
      ];
    }),
  ) as Record<Year, { valid: number; bolsonaro: number | null; lula_haddad: number | null }>;
  const transitions = Object.fromEntries(
    ([2018, 2022] as const).map((year) => {
      const matrix = classes.map(() => classes.map(() => 0));
      for (const r of cohort)
        matrix[classes.indexOf(r.values![year].leader)][classes.indexOf(r.values![2026].leader)]++;
      const net = counts();
      classes.forEach((c, i) => {
        net[c] = matrix.reduce((n, row) => n + row[i], 0) - matrix[i].reduce((a, b) => a + b, 0);
      });
      const delta = (series: 'bolsonaro' | 'lula_haddad') =>
        shares[year][series] === null || shares[2026][series] === null
          ? null
          : (shares[2026][series]! - shares[year][series]!) * 100;
      return [
        year,
        {
          matrix,
          net,
          bolsonaroToLula: matrix[0][1],
          lulaToBolsonaro: matrix[1][0],
          deltas: { bolsonaro: delta('bolsonaro'), lula_haddad: delta('lula_haddad') },
        },
      ];
    }),
  ) as Record<
    2018 | 2022,
    {
      matrix: number[][];
      net: Record<Leader, number>;
      bolsonaroToLula: number;
      lulaToBolsonaro: number;
      deltas: { bolsonaro: number | null; lula_haddad: number | null };
    }
  >;
  return {
    environment: dataset.environment,
    basis: 'historical_zone_cohort' as const,
    at,
    unitKind,
    status: registryReady ? 'ready' : 'pending_validation',
    coverage: { expected: registryReady ? units.size : null, completed, comparable: cohort.length },
    leadership,
    shares,
    transitions,
    rows,
    registryDigest: dataset.registryDigest,
  };
}
export type ZoneComparison = ReturnType<typeof compareZones>;
