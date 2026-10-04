import type { CandidateResult, Snapshot } from '../../../../packages/domain/src/index';
import type { MapRow } from '../useDashboard';
import type { ComparisonResponse, ZoneFeedItem } from './useTelao';

/**
 * DEMONSTRATION ONLY: a synthetic national count generated in the browser to show the big-screen
 * motion (bulletins, rolling digits, track, facts). Generic names, never TSE data, never stored.
 */
export type DemoScenario = 'segundo-turno' | 'vitoria';
export const DEMO_STEPS = 40;
const REGISTERED = 158_745_502,
  SECTIONS = 472_075;
/** Registered voters per UF/exterior (public reference values, used only to size the demo). */
const ELECTORATE: Record<string, number> = {
  ac: 613742,
  al: 2442126,
  am: 2798611,
  ap: 576988,
  ba: 11312752,
  ce: 6996545,
  df: 2258320,
  es: 2991650,
  go: 5080590,
  ma: 5183115,
  mg: 16372372,
  ms: 2024430,
  mt: 2637801,
  pa: 6262397,
  pb: 3248531,
  pe: 7223450,
  pi: 2704758,
  pr: 8613657,
  rj: 12857648,
  rn: 2659825,
  ro: 1265893,
  rr: 401521,
  rs: 8522545,
  sc: 5734651,
  se: 1740135,
  sp: 34122892,
  to: 1182023,
  zz: 916534,
};
const UFS = Object.keys(ELECTORATE);
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

/** National synthetic snapshot scaled to one territory's electorate. */
function scaled(s: Snapshot, f: number): Snapshot {
  const r = (v: number | null) => (v === null ? null : Math.round(v * f));
  return {
    ...s,
    electorate: {
      ...s.electorate,
      total: r(s.electorate.total)!,
      totalized: r(s.electorate.totalized)!,
      installed: r(s.electorate.installed)!,
      turnout: r(s.electorate.turnout)!,
    },
    votes: {
      ...s.votes,
      total: r(s.votes.total),
      valid: r(s.votes.valid),
      blank: r(s.votes.blank),
      null: r(s.votes.null),
    },
    candidates: s.candidates.map((c) => ({ ...c, countedVotes: r(c.countedVotes) })),
  };
}

export function demoMap(k: number, scenario: DemoScenario): MapRow[] {
  return UFS.map((uf, i) => {
    // Regions report at different speeds and lean differently (synthetic).
    const speed = 0.75 + ((i * 37) % 50) / 100;
    const lean = (((i * 53) % 27) - 13) / 100;
    // Each state reports every 2–4 bulletins (synthetic), not all at once.
    const period = 2 + (i % 3);
    const own = Math.max(0, k - ((k + i) % period));
    const s = Math.min(1, progress(own) * speed);
    const step = Math.round(s * DEMO_STEPS);
    const base = scaled(demoSnapshot(step, scenario, 0), ELECTORATE[uf] / REGISTERED);
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

/** Synthetic município–zona updates for the demo feed (no real municipality names). */
export function demoFeed(k: number, scenario: DemoScenario): ZoneFeedItem[] {
  const ufs = Object.keys(ELECTORATE).filter((u) => u !== 'zz');
  const sh = shares(progress(k), scenario);
  return [0, 1, 2].map((j) => {
    const seed = (k * 7 + j * 13) % 97;
    const uf = ufs[(k * 5 + j * 11) % ufs.length];
    const added = 4 + (seed % 26);
    const valid = added * (180 + (seed % 60));
    const tilt = ((seed % 21) - 10) / 100;
    const l = Math.round(valid * Math.max(0.05, sh.l + tilt)),
      f = Math.round(valid * Math.max(0.05, sh.f - tilt));
    return {
      uf,
      municipality: String(10000 + seed * 37).slice(0, 5),
      municipalityName: null,
      zone: String(1 + ((seed * 3) % 400)).padStart(4, '0'),
      capturedAt: new Date(Date.now() - j * 700).toISOString(),
      status: 'partial',
      sections: { total: 60, totalized: Math.min(60, added + seed), added },
      validAdded: valid,
      added: { 'demo-l': l, 'demo-f': f, 'demo-0': Math.max(0, valid - l - f) },
    };
  });
}
