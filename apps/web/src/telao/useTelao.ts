import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Snapshot } from '../../../../packages/domain/src/index';
import type { ZoneComparison } from '../../../../packages/domain/src/zones';
import { api } from '../format';
import type { EnvironmentConfig } from '../environment';
import type { CollectionState, MapRow } from '../useDashboard';
import { bulletins } from './race';
import { changedTerritories, mergeTimeline, type Change } from './changes';
import {
  DEMO_STEPS,
  demoComparison,
  demoFeed,
  demoMap,
  demoSnapshot,
  type DemoScenario,
} from './demo';

export type ComparisonResponse = {
  status?: string;
  reason?: string;
  comparison: ZoneComparison | null;
  timeline: Omit<ZoneComparison, 'rows'>[];
  method?: string;
  series?: Record<'bolsonaro' | 'lula_haddad', { id: string; number: string }>;
};
export type StatusResponse = {
  environment: string;
  captures: number;
  lastCapture: string | null;
  collection?: CollectionState;
};

const LATEST_MS = 5_000,
  MAP_MS = 10_000,
  SLOW_MS = 30_000;

/** One município–zona unit that counted new sections (see API zone-feed). */
export type ZoneFeedItem = {
  uf: string;
  municipality: string;
  municipalityName: string | null;
  zone: string;
  capturedAt: string;
  status: string;
  sections: { total: number; totalized: number; added: number };
  validAdded: number;
  added: Record<string, number>;
};

/** States changed by the latest observed bulletin, and when that was observed. */
export type Changes = { items: Change[]; at: number };
type Point = ComparisonResponse['timeline'][number];

/**
 * Data for the big-screen view: the national presidential snapshot every 5 s (history only when a
 * new bulletin arrives), UF snapshots every 10 s (to react to state bulletins), comparison and
 * collector state every 30 s. Failures keep the last data.
 */
export function useTelao(env: EnvironmentConfig) {
  const { base } = env;
  const [series, setSeries] = useState<Snapshot[]>([]);
  const [map, setMap] = useState<MapRow[]>([]);
  const [changes, setChanges] = useState<Changes>({ items: [], at: 0 });
  const [feed, setFeed] = useState<ZoneFeedItem[]>([]);
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null);
  const [history, setHistory] = useState<Point[]>([]);
  const [comparisonError, setComparisonError] = useState('');
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [lastOk, setLastOk] = useState<number | null>(null);
  const [error, setError] = useState('');
  const digest = useRef<string | null>(null);
  const previousMap = useRef<MapRow[] | null>(null);

  const pollLatest = useCallback(async () => {
    try {
      const latest = await api<{ snapshot: Snapshot | null }>(
        `${base}/latest?territory=br&office=president`,
      );
      if (latest.snapshot && latest.snapshot.digest !== digest.current) {
        const all = await api<Snapshot[]>(`${base}/snapshots?territory=br&office=president`);
        digest.current = latest.snapshot.digest;
        setSeries(bulletins(all));
      }
      setLastOk(Date.now());
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [base]);

  const pollMap = useCallback(async () => {
    const [m, x, f] = await Promise.allSettled([
      api<MapRow[]>(`${base}/map?territory=br&office=president`),
      // Exterior is not a map row (no geometry) but belongs in the proportional state mosaic.
      api<{ snapshot: Snapshot | null }>(`${base}/latest?territory=zz&office=president`),
      api<ZoneFeedItem[]>(`${base}/zone-feed?limit=10`),
    ]);
    if (f.status === 'fulfilled') setFeed(f.value);
    if (m.status !== 'fulfilled') return;
    const rows = [
      ...m.value.filter((r) => r.territoryId !== 'zz'),
      ...(x.status === 'fulfilled' && x.value.snapshot
        ? [{ territoryId: 'zz', snapshot: x.value.snapshot }]
        : []),
    ];
    const changed = changedTerritories(previousMap.current, rows);
    previousMap.current = rows;
    setMap(rows);
    if (changed.length) setChanges({ items: changed, at: Date.now() });
  }, [base]);

  const pollSlow = useCallback(async () => {
    const [c, s] = await Promise.allSettled([
      env.comparison.available
        ? api<ComparisonResponse>(`${base}/comparison?territory=br&office=president`)
        : Promise.reject(Error(env.comparison.summary)),
      api<StatusResponse>(`${base}/status`),
    ]);
    if (c.status === 'fulfilled') {
      setComparison(c.value);
      setHistory((h) => mergeTimeline(h, c.value.timeline));
      setComparisonError('');
    } else setComparisonError((c.reason as Error).message);
    if (s.status === 'fulfilled') setStatus(s.value);
  }, [base, env.comparison]);

  useEffect(() => {
    pollLatest();
    pollMap();
    pollSlow();
    const timers = [
      window.setInterval(pollLatest, LATEST_MS),
      window.setInterval(pollMap, MAP_MS),
      window.setInterval(pollSlow, SLOW_MS),
    ];
    return () => timers.forEach((t) => window.clearInterval(t));
  }, [pollLatest, pollMap, pollSlow]);

  return {
    series,
    current: series.at(-1) ?? null,
    previous: series.at(-2) ?? null,
    map,
    changes,
    feed,
    comparison,
    /** Every comparison point received since the screen opened (the API sends the last 20). */
    history,
    comparisonError,
    status,
    lastOk,
    error,
  };
}
export type Telao = ReturnType<typeof useTelao>;

/**
 * Demonstration data source with the same shape as useTelao: a synthetic count advancing one
 * bulletin every `intervalMs`, looping after the end. Lets the motion be seen before results exist.
 */
export function useDemo(scenario: DemoScenario, intervalMs = 3000): Telao {
  const [k, setK] = useState(0);
  const [series, setSeries] = useState<Snapshot[]>([]);
  const [history, setHistory] = useState<Point[]>([]);
  const [changes, setChanges] = useState<Changes>({ items: [], at: 0 });
  const previousMap = useRef<MapRow[] | null>(null);
  const [feed, setFeed] = useState<ZoneFeedItem[]>([]);
  useEffect(() => {
    const timer = window.setInterval(
      () => setK((step) => (step >= DEMO_STEPS + 4 ? 0 : step + 1)),
      intervalMs,
    );
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  const step = Math.min(k, DEMO_STEPS);
  // One "verification" per demo bulletin (stable between renders).
  const checkedAt = useMemo(() => Date.now(), [k]);
  const map = useMemo(() => demoMap(step, scenario), [step, scenario]);
  const comparison = useMemo(
    () => demoComparison(step, scenario, Date.now() - step * 1000),
    [step, scenario],
  );
  useEffect(() => {
    const snapshot = demoSnapshot(step, scenario, Date.now() - step * 1000);
    setSeries((previous) =>
      k === 0
        ? [snapshot]
        : previous.at(-1)?.digest === snapshot.digest
          ? previous
          : [...previous, snapshot],
    );
    const changed = changedTerritories(k === 0 ? null : previousMap.current, map);
    previousMap.current = map;
    if (changed.length) setChanges({ items: changed, at: Date.now() });
    setHistory((h) => (k === 0 ? comparison.timeline : mergeTimeline(h, comparison.timeline)));
    setFeed((items) => (k === 0 ? [] : [...demoFeed(step, scenario), ...items].slice(0, 10)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k, scenario]);
  return {
    series,
    current: series.at(-1) ?? null,
    previous: series.at(-2) ?? null,
    map,
    changes,
    feed,
    comparison,
    history,
    comparisonError: '',
    status: {
      environment: 'fixture',
      captures: series.length,
      lastCapture: null,
      collection: { running: true, lastObservation: null, collector: null, coverage: null },
    },
    lastOk: checkedAt,
    error: '',
  };
}
