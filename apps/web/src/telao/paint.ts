import { useRef } from 'react';
import type { CandidateResult } from '../../../../packages/domain/src/index';

/** Two candidate slots; colors live in CSS tokens (--cand-a…) so both themes are selected. */
export type Slot = 'a' | 'b';
export const paint = (slot: Slot | undefined) =>
  slot
    ? {
        main: `var(--cand-${slot})`,
        inc: `var(--cand-${slot}-inc)`,
        soft: `var(--cand-${slot}-soft)`,
      }
    : { main: 'var(--cand-other)', inc: 'var(--cand-other)', soft: 'var(--surface-2)' };

/**
 * Color follows the candidate, never the rank. With the official series identities, the 2026
 * candidate of `bolsonaro` is slot a and of `lula_haddad` slot b (same as the same-zones chart).
 * Otherwise slots are assigned once, in candidate-number order, and kept for the session.
 */
export function useSlots(
  leaders: CandidateResult[],
  series?: Record<'bolsonaro' | 'lula_haddad', { id: string; number: string }>,
) {
  const assigned = useRef(new Map<string, Slot>());
  if (series) {
    assigned.current.set(series.bolsonaro.id, 'a');
    assigned.current.set(series.lula_haddad.id, 'b');
  }
  const free = (['a', 'b'] as Slot[]).filter((s) => ![...assigned.current.values()].includes(s));
  for (const c of [...leaders].sort((x, y) => x.number.localeCompare(y.number)))
    if (!assigned.current.has(c.id) && free.length) assigned.current.set(c.id, free.shift()!);
  return (id: string) => assigned.current.get(id);
}
