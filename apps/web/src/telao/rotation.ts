import { useEffect, useRef, useState } from 'react';

/**
 * Rotating focus over `ids` (one every `ms`). Keeps the current focus when the list changes,
 * restarts the cycle timer on every step so a progress line can follow it.
 */
export function useRotation(ids: string[], ms = 7000) {
  const [index, setIndex] = useState(0);
  const [since, setSince] = useState(() => Date.now());
  const key = ids.join(',');
  const current = useRef<string | null>(null);
  useEffect(() => {
    if (!ids.length) return;
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % ids.length);
      setSince(Date.now());
    }, ms);
    return () => window.clearInterval(timer);
    // `key` captures list changes without restarting on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ms]);
  // Keep pointing at the same territory when the order changes (new electorate data).
  useEffect(() => {
    if (current.current && ids.includes(current.current)) setIndex(ids.indexOf(current.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const focus = ids.length ? ids[index % ids.length] : null;
  current.current = focus;
  return { focus, since, ms };
}
