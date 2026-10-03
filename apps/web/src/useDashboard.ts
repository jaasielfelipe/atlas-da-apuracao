import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Bootstrap, Layer, Office, Snapshot } from '../../../packages/domain/src/index';
import { api } from './format';
import type { EnvironmentConfig } from './environment';

export type View = { snapshot: Snapshot | null; monitoring: boolean; status: string };
export type MapRow = { territoryId: string; snapshot: Snapshot | null };
export type CollectionState = {
  running: boolean;
  lastObservation: string | null;
  collector: {
    updatedAt: string;
    rate: { observedRps10s: number; pausedUntil: string | null };
  } | null;
  coverage: {
    expectedSegments: number;
    observedSegments: number;
    completeSegments: number;
    expectedZones: number;
    completeZones: number;
  } | null;
};
export type DashboardBootstrap = Bootstrap & {
  collectionRunning?: boolean;
  collection?: CollectionState;
};

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Dashboard state and data loading, shared by every environment. */
export function useDashboard(env: EnvironmentConfig) {
  const { base, live } = env;
  const [bootstrap, setBootstrap] = useState<DashboardBootstrap | null>(null),
    [error, setError] = useState('');
  const [territoryId, setTerritory] = useState('br'),
    [office, setOffice] = useState<Office>('president'),
    [layer, setLayer] = useState<Layer>('result');
  const [at, setAt] = useState<string | null>(null),
    [playing, setPlaying] = useState(false),
    [scale, setScale] = useState<'time' | 'progress'>('time'),
    [metric, setMetric] = useState<'share' | 'votes'>('share');
  const [view, setView] = useState<View | null>(null),
    [snapshots, setSnapshots] = useState<Snapshot[]>([]),
    [rows, setRows] = useState<MapRow[]>([]);
  const [search, setSearch] = useState(''),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    const b = await api<DashboardBootstrap>(`${base}/bootstrap`);
    setBootstrap(b);
    setRevision((n) => n + 1);
  }, [base]);
  const retry = useCallback(() => {
    refresh().catch((e) => setError(e.message));
  }, [refresh]);
  useEffect(() => {
    refresh().catch((e) => {
      setError(e.message);
      setLoading(false);
    });
  }, [refresh]);
  // Live archive: follow new captures while showing "now"; replay instants stay fixed.
  useEffect(() => {
    if (!live || at) return;
    const timer = window.setInterval(retry, 20_000);
    return () => window.clearInterval(timer);
  }, [live, at, retry]);
  const territory = bootstrap?.territories.find((t) => t.id === territoryId);
  useEffect(() => {
    if (!bootstrap || !territory) return;
    let active = true;
    setLoading(true);
    const query = new URLSearchParams({ office, territory: territoryId, ...(at ? { at } : {}) });
    const mapQuery = new URLSearchParams({
      office,
      territory: territory.uf ?? 'br',
      ...(at ? { at } : {}),
    });
    Promise.all([
      api<View>(`${base}/latest?${query}`),
      api<Snapshot[]>(
        `${base}/snapshots?${new URLSearchParams({ office, territory: territoryId })}`,
      ),
      api<MapRow[]>(`${base}/map?${mapQuery}`),
    ])
      .then(([v, series, map]) => {
        if (active) {
          setView(v);
          setSnapshots(series);
          setRows(map);
          setError('');
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [territoryId, office, at, revision, bootstrap, territory, base]);
  useEffect(() => {
    if (!playing || !bootstrap) return;
    const timer = window.setInterval(() => {
      setAt((previous) => {
        const index = bootstrap.captures.indexOf(previous ?? '');
        if (index + 1 >= bootstrap.captures.length) {
          setPlaying(false);
          return previous;
        }
        return bootstrap.captures[index + 1];
      });
    }, 1300);
    return () => window.clearInterval(timer);
  }, [playing, bootstrap]);
  const select = useCallback((id: string) => {
    setTerritory(id);
    setSearch('');
    setView(null);
    setRows([]);
    setSnapshots([]);
  }, []);
  const selectTime = useCallback((instant: string) => {
    setAt(instant);
    setPlaying(false);
  }, []);
  const changeOffice = useCallback(
    (next: Office) => {
      setOffice(next);
      setView(null);
      if (next === 'governor' && territory && ['br', 'exterior'].includes(territory.kind))
        select('ac');
    },
    [territory, select],
  );
  const goNow = useCallback(() => {
    setAt(null);
    setPlaying(false);
  }, []);
  const togglePlay = useCallback(() => {
    if (!bootstrap) return;
    if (playing) setPlaying(false);
    else {
      const last = bootstrap.captures.length - 1;
      if (!at || bootstrap.captures.indexOf(at) === last) setAt(bootstrap.captures[0]);
      setPlaying(true);
    }
  }, [bootstrap, playing, at]);
  // Live colors: top three of the scope (national sum for president, selected UF for governor).
  const ranking = useMemo(() => {
    if (!live) return undefined;
    const totals = new Map<string, number>();
    for (const r of rows) {
      const t = bootstrap?.territories.find((x) => x.id === r.territoryId);
      if (t?.kind !== 'uf' || (office === 'governor' && t.id !== territory?.uf)) continue;
      for (const c of r.snapshot?.candidates ?? [])
        if (c.validShare !== null)
          totals.set(c.number, (totals.get(c.number) ?? 0) + (c.countedVotes ?? 0));
    }
    return [...totals].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  }, [live, rows, bootstrap, office, territory]);
  const legend = useMemo(() => {
    const names = new Map<string, string>();
    for (const r of rows) for (const c of r.snapshot?.candidates ?? []) names.set(c.number, c.name);
    return (ranking ?? []).slice(0, 3).map((n) => ({ number: n, name: names.get(n) ?? n }));
  }, [rows, ranking]);
  const candidates = useMemo(
    () =>
      [...(view?.snapshot?.candidates ?? [])].sort(
        (a, b) => (b.countedVotes ?? -1) - (a.countedVotes ?? -1),
      ),
    [view],
  );
  const hits = useMemo(
    () =>
      search.length < 2
        ? []
        : (bootstrap?.territories ?? [])
            .filter(
              (t) => t.kind === 'municipality' && normalize(t.name).includes(normalize(search)),
            )
            .slice(0, 7),
    [search, bootstrap],
  );
  async function mutate(url: string, method: string, body?: unknown) {
    setBusy(true);
    try {
      await api(url, method, body);
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const watching = !!bootstrap?.watchlist.some((w) => w.enabled && w.territoryId === territoryId);
  const toggleWatch = () =>
    mutate(
      watching ? `${base}/watchlist/${encodeURIComponent(territoryId)}` : `${base}/watchlist`,
      watching ? 'DELETE' : 'POST',
      watching ? undefined : { territoryId },
    );
  const advanceFixture = () => mutate('/api/v1/fixture/advance', 'POST');
  return {
    env,
    bootstrap,
    territory,
    territoryId,
    office,
    layer,
    at,
    playing,
    scale,
    metric,
    view,
    snapshot: view?.snapshot ?? null,
    snapshots,
    rows,
    search,
    revision,
    busy,
    loading,
    error,
    ranking,
    legend,
    candidates,
    hits,
    watching,
    setLayer,
    setScale,
    setMetric,
    setSearch,
    select,
    selectTime,
    changeOffice,
    goNow,
    togglePlay,
    retry,
    toggleWatch,
    advanceFixture,
  };
}
export type Dashboard = ReturnType<typeof useDashboard>;
/** Dashboard after bootstrap and territory are known (what the panels render with). */
export type ReadyDashboard = Dashboard & {
  bootstrap: DashboardBootstrap;
  territory: NonNullable<Dashboard['territory']>;
};
