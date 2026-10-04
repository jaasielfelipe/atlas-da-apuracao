import type { CandidateResult, Snapshot } from '../../../../packages/domain/src/index';

/** Track length in votes: 55% of registered voters (fixed for the whole count). */
export const TRACK_SHARE = 0.55;

export type RaceState = {
  registered: number;
  trackVotes: number;
  /** Fixed line: half of registered voters. */
  fixedLine: number;
  /**
   * Adjusted target: half of the largest valid-vote total still possible, i.e.
   * (registered − abstentions − blank − null − annulled) / 2 with counted values. It only recedes
   * as the count advances; at the end it is half of the valid votes (plus sub judice, if any).
   */
  target: number;
  /** Votes needed to pass the adjusted target (absolute majority = more than half). */
  toWin: number;
  abstentions: number;
  blankNull: number;
  others: number;
};

const n = (v: number | null | undefined) => v ?? 0;

export function raceState(s: Snapshot, leaders: string[]): RaceState {
  const registered = s.electorate.total;
  const abstentions = Math.max(0, s.electorate.installed - s.electorate.turnout);
  const blankNull = n(s.votes.blank) + n(s.votes.null);
  const target = Math.max(0, (registered - abstentions - blankNull - n(s.votes.annulled)) / 2);
  const others = s.candidates
    .filter((c) => c.validShare !== null && !leaders.includes(c.id))
    .reduce((a, c) => a + n(c.countedVotes), 0);
  return {
    registered,
    trackVotes: registered * TRACK_SHARE,
    fixedLine: registered / 2,
    target,
    toWin: Math.floor(target) + 1,
    abstentions,
    blankNull,
    others,
  };
}

/** Two leading candidates by votes among those whose votes count as valid. */
export function leaders(s: Snapshot): CandidateResult[] {
  return [...s.candidates]
    .filter((c) => c.validShare !== null && c.countedVotes !== null)
    .sort((a, b) => b.countedVotes! - a.countedVotes! || a.number.localeCompare(b.number))
    .slice(0, 2);
}

/**
 * Increment since the previous bulletin. A decrease (TSE correction) is never drawn as a
 * negative increment: the new value is shown without a highlighted segment.
 */
export function increment(current: number, previous: number | null | undefined) {
  if (previous == null) return { from: current, delta: null as number | null, corrected: false };
  if (current < previous) return { from: current, delta: 0, corrected: true };
  return { from: previous, delta: current - previous, corrected: false };
}

/** Distinct bulletins (by content), oldest first; the dashboard compares the last two. */
export function bulletins(snapshots: Snapshot[]) {
  const out: Snapshot[] = [];
  for (const s of snapshots) if (out.at(-1)?.digest !== s.digest) out.push(s);
  return out;
}

/** Sections counted per minute over the last `windowMs`, from observed bulletins only. */
export function pace(series: Snapshot[], windowMs = 10 * 60_000) {
  const last = series.at(-1);
  if (!last) return null;
  const end = Date.parse(last.capturedAt);
  const first = series.find((s) => Date.parse(s.capturedAt) >= end - windowMs);
  if (!first || first === last) return null;
  const minutes = (end - Date.parse(first.capturedAt)) / 60_000;
  const sections = last.sections.totalized - first.sections.totalized;
  const share =
    last.sections.share !== null && first.sections.share !== null
      ? (last.sections.share - first.sections.share) * 100
      : null;
  return { minutes, sections, share };
}
