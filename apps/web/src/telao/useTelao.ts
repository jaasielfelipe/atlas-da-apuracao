import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Snapshot } from '../../../../packages/domain/src/index';
import type { ZoneComparison } from '../../../../packages/domain/src/zones';
import { api } from '../format';
import type { EnvironmentConfig } from '../environment';
import type { CollectionState, MapRow } from '../useDashboard';
import { bulletins } from './race';
import { DEMO_STEPS, demoComparison, demoMap, demoSnapshot, type DemoScenario } from './demo';

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
  SLOW_MS = 30_000;

/**
 * Data for the big-screen view: the national presidential snapshot every 5 s (history only when a
 * new bulletin arrives), comparison/UF/collector state every 30 s. Failures keep the last data.
 */
export function useTelao(env: EnvironmentConfig) {
  const { base } = env;
  const [series, setSeries] = useState<Snapshot[]>([]);
  const [map, setMap] = useState<MapRow[]>([]);
  const [comparison, setComparison] = useState<ComparisonResponse | null>(null);
  const [comparisonError, setComparisonError] = useState('');
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [lastOk, setLastOk] = useState<number | null>(null);
  const [error, setError] = useState('');
  const digest = useRef<string | null>(null);

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

  const pollSlow = useCallback(async () => {
    const [m, c, s] = await Promise.allSettled([
      api<MapRow[]>(`${base}/map?territory=br&office=president`),
      env.comparison.available
        ? api<ComparisonResponse>(`${base}/comparison?territory=br&office=president`)
        : Promise.reject(Error(env.comparison.summary)),
      api<StatusResponse>(`${base}/status`),
    ]);
    if (m.status === 'fulfilled') setMap(m.value);
    if (c.status === 'fulfilled') {
      setComparison(c.value);
      setComparisonError('');
    } else setComparisonError((c.reason as Error).message);
    if (s.status === 'fulfilled') setStatus(s.value);
  }, [base, env.comparison]);

  useEffect(() => {
    pollLatest();
    pollSlow();
    const fast = window.setInterval(pollLatest, LATEST_MS),
      slow = window.setInterval(pollSlow, SLOW_MS);
    return () => {
      window.clearInterval(fast);
      window.clearInterval(slow);
    };
  }, [pollLatest, pollSlow]);

  return {
    series,
    current: series.at(-1) ?? null,
    previous: series.at(-2) ?? null,
    map,
    comparison,
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
  useEffect(() => {
    const timer = window.setInterval(
      () => setK((step) => (step >= DEMO_STEPS + 4 ? 0 : step + 1)),
      intervalMs,
    );
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  useEffect(() => {
    const step = Math.min(k, DEMO_STEPS);
    const snapshot = demoSnapshot(step, scenario, Date.now() - step * 1000);
    setSeries((previous) =>
      k === 0
        ? [snapshot]
        : previous.at(-1)?.digest === snapshot.digest
          ? previous
          : [...previous, snapshot],
    );
  }, [k, scenario]);
  const step = Math.min(k, DEMO_STEPS);
  const map = useMemo(() => demoMap(step, scenario), [step, scenario]);
  const comparison = useMemo(
    () => demoComparison(step, scenario, Date.now() - step * 1000),
    [step, scenario],
  );
  return {
    series,
    current: series.at(-1) ?? null,
    previous: series.at(-2) ?? null,
    map,
    comparison,
    comparisonError: '',
    status: {
      environment: 'fixture',
      captures: series.length,
      lastCapture: null,
      collection: { running: true, lastObservation: null, collector: null, coverage: null },
    },
    lastOk: Date.now(),
    error: '',
  };
}
