import { useEffect, useRef, useState } from 'react';

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

/**
 * Digits roll like an odometer when the value changes. Non-digits (separators, %, signs) stay
 * fixed; characters are keyed from the right so a new leading digit slides in without disturbing
 * the rest. The accessible name is the formatted text.
 */
export function Rolling({
  value,
  format,
  className,
}: {
  value: number | null | undefined;
  format: (n: number) => string;
  className?: string;
}) {
  const text = value == null || !Number.isFinite(value) ? '—' : format(value);
  const chars = [...text];
  return (
    <span className={`roll ${className ?? ''}`} aria-label={text} role="text">
      {chars.map((ch, i) => {
        const key = chars.length - i;
        if (!/\d/.test(ch))
          return (
            <span key={`s${key}`} aria-hidden="true">
              {ch}
            </span>
          );
        return (
          <span key={`d${key}`} className="roll-digit" aria-hidden="true">
            <span className="roll-strip" style={{ transform: `translateY(${-Number(ch) * 10}%)` }}>
              {'0123456789'.split('').map((d) => (
                <span key={d}>{d}</span>
              ))}
            </span>
          </span>
        );
      })}
    </span>
  );
}

/**
 * Smoothly follows `target` in value space (votes, not pixels), easing out over `ms`.
 * Jumps immediately on first render and under prefers-reduced-motion.
 */
export function useTween(target: number, ms = 1400) {
  const [value, setValue] = useState(target);
  const from = useRef(target),
    shown = useRef(target),
    first = useRef(true);
  useEffect(() => {
    if (first.current || reducedMotion()) {
      first.current = false;
      shown.current = target;
      setValue(target);
      return;
    }
    from.current = shown.current;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = 1 - (1 - t) ** 3;
      shown.current = from.current + (target - from.current) * eased;
      setValue(shown.current);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return value;
}

/** "12 s", "4 min", "2 h 05 min": readable from across the room. */
export function duration(seconds: number) {
  if (seconds < 90) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 90) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

/** Seconds since `since`, ticking once per second. */
export function useAge(since: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return since == null ? null : Math.max(0, Math.round((now - since) / 1000));
}

/** True for `ms` after `key` changes (not on first render): drives "novo boletim" flashes. */
export function useFlash(key: string | null | undefined, ms = 4000) {
  const [on, setOn] = useState(false);
  const previous = useRef(key);
  useEffect(() => {
    if (key == null || previous.current === key) return;
    const firstValue = previous.current == null;
    previous.current = key;
    if (firstValue) return;
    setOn(true);
    const timer = window.setTimeout(() => setOn(false), ms);
    return () => window.clearTimeout(timer);
  }, [key, ms]);
  return on;
}

/**
 * Secondary numbers: no rolling; the new value settles in with a short, quiet fade.
 * Keyed by the formatted text, so the animation runs only when the displayed value changes.
 */
export function Num({
  value,
  format,
  className,
}: {
  value: number | null | undefined;
  format: (n: number) => string;
  className?: string;
}) {
  const text = value == null || !Number.isFinite(value) ? '—' : format(value);
  return (
    <span key={text} className={`num ${className ?? ''}`}>
      {text}
    </span>
  );
}
