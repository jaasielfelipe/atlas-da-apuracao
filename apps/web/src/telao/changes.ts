import type { Snapshot } from '../../../../packages/domain/src/index';

export type Row = { territoryId: string; snapshot: Snapshot | null };
export type Change = { id: string; sections: number };

/**
 * Territories whose published snapshot changed between two polls, largest increase in counted
 * sections first. The first poll (no previous rows) reports nothing: no change was observed.
 */
export function changedTerritories(previous: Row[] | null, next: Row[], limit = 3): Change[] {
  if (!previous) return [];
  const before = new Map(previous.map((r) => [r.territoryId, r.snapshot]));
  const out: Change[] = [];
  for (const r of next) {
    const old = before.get(r.territoryId);
    if (!old || !r.snapshot || old.digest === r.snapshot.digest) continue;
    out.push({
      id: r.territoryId,
      sections: Math.max(0, r.snapshot.sections.totalized - old.sections.totalized),
    });
  }
  return out.sort((a, b) => b.sections - a.sections || a.id.localeCompare(b.id)).slice(0, limit);
}

/** Accumulates comparison points across polls: one per capture instant, oldest first, capped. */
export function mergeTimeline<T extends { at: string }>(previous: T[], next: T[], cap = 400): T[] {
  const byAt = new Map(previous.map((p) => [p.at, p]));
  for (const p of next) byAt.set(p.at, p);
  return [...byAt.values()].sort((a, b) => a.at.localeCompare(b.at)).slice(-cap);
}
