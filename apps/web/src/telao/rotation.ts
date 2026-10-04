import { useEffect, useRef, useState } from 'react';
import type { Changes } from './useTelao';

const MIN_DWELL_MS = 4500;

/**
 * Rotating focus over `ids` (one every `ms`). States changed by a new bulletin jump the queue:
 * the first one is focused immediately, the others on the following steps; then the regular
 * rotation resumes where it stopped. Every focus change restarts the step timer.
 */
export function useRotation(ids: string[], ms = 7000, changes?: Changes) {
  const [state, setState] = useState<{ focus: string | null; since: number; bulletin: boolean }>({
    focus: null,
    since: Date.now(),
    bulletin: false,
  });
  const index = useRef(-1);
  const queue = useRef<string[]>([]);
  const shown = useRef(0);
  const list = useRef(ids);
  list.current = ids;

  const step = () => {
    const known = list.current;
    while (queue.current.length && !known.includes(queue.current[0])) queue.current.shift();
    if (queue.current.length) {
      shown.current = Date.now();
      setState({ focus: queue.current.shift()!, since: shown.current, bulletin: true });
      return;
    }
    if (!known.length) return;
    index.current = (index.current + 1) % known.length;
    shown.current = Date.now();
    setState({ focus: known[index.current], since: shown.current, bulletin: false });
  };

  // Regular cadence; restarted whenever a bulletin forces an immediate step.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!ids.length) return;
    if (state.focus === null) step();
    const timer = window.setInterval(step, ms);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids.length > 0, ms, tick]);

  useEffect(() => {
    if (!changes || !changes.items.length) return;
    const fresh = changes.items.map((c) => c.id).filter((id) => list.current.includes(id));
    if (!fresh.length) return;
    queue.current = [...fresh, ...queue.current.filter((id) => !fresh.includes(id))].slice(0, 6);
    // Minimum dwell: a state just put in focus is not cut short; the change waits in the queue.
    if (Date.now() - shown.current < MIN_DWELL_MS) return;
    step();
    setTick((t) => t + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changes?.at]);

  return { ...state, ms };
}
