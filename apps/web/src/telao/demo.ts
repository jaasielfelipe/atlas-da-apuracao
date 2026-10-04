import type { CandidateResult, Snapshot } from '../../../../packages/domain/src/index';
import type { MapRow } from '../useDashboard';
import type { ComparisonResponse } from './useTelao';

/**
 * DEMONSTRATION ONLY: a synthetic national count generated in the browser to show the big-screen
 * motion (bulletins, rolling digits, track, facts). Generic names, never TSE data, never stored.
 */
export type DemoScenario = 'segundo-turno' | 'vitoria';
export const DEMO_STEPS = 40;
const REGISTERED = 158_745_502,
  SECTIONS = 472_075;
const UFS =
  'ac,al,ap,am,ba,ce,df,es,go,ma,mt,ms,mg,pa,pb,pr,pe,pi,rj,rn,rs,ro,rr,sc,sp,se,to'.split(',');
export const DEMO_SERIES = {
  bolsonaro: { id: 'demo-f', number: '2' },
  lula_haddad: { id: 'demo-l', number: '1' },
};

/** Counting progress at step k: slow start, fast middle, long tail (as on election night). */
const progress = (k: number) => {
  const t = Math.min(1, k / DEMO_STEPS);
  return Math.min(1, 1 - (1 - t) ** 2.2 * (1 - 0.15 * t));
};

function shares(s: number, scenario: DemoScenario) {
  // F leads early; L overtakes as later regions report (synthetic).
  const l = scenario === 'vitoria' ? 0.44 + 0.1 * s : 0.4 + 0.08 * s;
  const f = scenario === 'vitoria' ? 0.48 - 0.06 * s : 0.5 - 0.065 * s;
  const rest = 1 - l - f;
  return { l, f, others: [0.38, 0.22, 0.16, 0.12, 0.08, 0.04].map((w) => w * rest) };
}

export function demoSnapshot(k: number, scenario: DemoScenario, start: number): Snapshot {
  const s = progress(k);
  const counted = Math.round(REGISTERED * s);
  const turnout = Math.round(counted * 0.79),
    blank = Math.round(turnout * 0.024),
    nul = Math.round(turnout * 0.037),
    valid = turnout - blank - nul;
  const sh = shares(s, scenario);
  const make = (id: string, number: string, name: string, share: number): CandidateResult => ({
    id,
    number,
    name,
    party: 'DEMO',
    destination: 'Válido',
    countedVotes: Math.round(valid * share),
    validShare: valid ? share : null,
  });
  const candidates = [
    make('demo-l', '1', 'CANDIDATURA L', sh.l),
    make('demo-f', '2', 'CANDIDATURA F', sh.f),
    ...sh.others.map((share, i) =>
      make(`demo-${i}`, String(3 + i), `CANDIDATURA ${'CDEGHJ'[i]}`, share),
    ),
  ];
  const at = new Date(start + k * 1000).toISOString();
  return {
    id: `demo-${scenario}-${k}`,
    environment: 'fixture',
    electionId: 'demo',
    office: 'president',
    territoryId: 'br',
    round: '1',
    phase: 's',
    basis: 'synthetic',
    capturedAt: at,
    sourceGeneratedAt: at,
    sourceTotalizedAt: at,
    sourceIdg: 'demo',
    sourceUrl: 'demonstração gerada no navegador',
    digest: `demo-${scenario}-${k}`,
    rawDigest: 'demo',
    status: 'updated',
    progress: s >= 1 ? 'f' : 'p',
    finalTotalization: s >= 1,
    sections: { total: SECTIONS, totalized: Math.round(SECTIONS * s), share: s },
    electorate: {
      total: REGISTERED,
      totalized: counted,
      installed: counted,
      turnout,
      share: s,
      turnoutShare: counted ? turnout / counted : null,
    },
    votes: {
      total: turnout,
      valid,
      toCandidates: valid,
      blank,
      null: nul,
      annulled: 0,
      subJudice: 0,
    },
    candidates,
    warnings: [],
  };
}

export function demoMap(k: number, scenario: DemoScenario): MapRow[] {
  return UFS.map((uf, i) => {
    // Regions report at different speeds and lean differently (synthetic).
    const speed = 0.75 + ((i * 37) % 50) / 100;
    const lean = (((i * 53) % 27) - 13) / 100;
    const s = Math.min(1, progress(k) * speed);
    const base = demoSnapshot(Math.round(s * DEMO_STEPS), scenario, 0);
    const l = Math.max(0.05, base.candidates[0].validShare! + lean),
      f = Math.max(0.05, base.candidates[1].validShare! - lean);
    const valid = base.votes.valid ?? 0;
    return {
      territoryId: uf,
      snapshot:
        s === 0
          ? null
          : {
              ...base,
              territoryId: uf,
              sections: { ...base.sections, share: s },
              candidates: base.candidates.map((c, j) =>
                j === 0
                  ? { ...c, validShare: l, countedVotes: Math.round(valid * l) }
                  : j === 1
                    ? { ...c, validShare: f, countedVotes: Math.round(valid * f) }
                    : c,
              ),
            },
    };
  });
}

export function demoComparison(
  k: number,
  scenario: DemoScenario,
  start: number,
): ComparisonResponse {
  const point = (j: number) => {
    const s = progress(j);
    const comparable = Math.round(2580 * Math.max(0, s - 0.08) ** 1.6);
    const sh = shares(s, scenario);
    const valid = comparable * 28_000;
    return {
      environment: 'fixture' as const,
      basis: 'historical_zone_cohort' as const,
      at: new Date(start + j * 1000).toISOString(),
      unitKind: 'whole_zone' as const,
      status: 'ready',
      coverage: { expected: 2641, completed: Math.round(comparable * 1.03), comparable },
      leadership: {} as never,
      transitions: {} as never,
      registryDigest: 'demo',
      shares: {
        2026: {
          valid,
          lula_haddad: comparable ? sh.l + 0.012 : null,
          bolsonaro: comparable ? sh.f - 0.01 : null,
        },
        2022: {
          valid: valid * 0.97,
          lula_haddad: comparable ? 0.468 + 0.03 * s : null,
          bolsonaro: comparable ? 0.452 - 0.025 * s : null,
        },
        2018: {
          valid: valid * 0.93,
          lula_haddad: comparable ? 0.27 + 0.05 * s : null,
          bolsonaro: comparable ? 0.49 - 0.04 * s : null,
        },
      },
    };
  };
  const timeline = Array.from({ length: Math.min(20, k + 1) }, (_, i) =>
    point(Math.max(0, k - 19) + i),
  );
  return {
    comparison: { ...point(k), rows: [] } as unknown as ComparisonResponse['comparison'],
    timeline: timeline as unknown as ComparisonResponse['timeline'],
    series: DEMO_SERIES,
  };
}
