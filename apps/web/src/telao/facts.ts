import type { CandidateResult, Snapshot } from '../../../../packages/domain/src/index';
import { raceState } from './race';

/**
 * Arithmetic facts that the published count already guarantees, whatever happens in the sections
 * not yet counted (user decision, 04/10/2026). Each uses the conservative bound: every remaining
 * registered voter could vote, and could vote for the candidate least favourable to the claim.
 * They are facts about published numbers, subject to TSE corrections; never forecasts.
 */
export type MathFact =
  | { kind: 'victory'; candidate: CandidateResult }
  | { kind: 'runoff' }
  | { kind: 'finalists'; candidates: [CandidateResult, CandidateResult] };

const subJudice = (c: CandidateResult) => /sub\s*judice/i.test(c.destination ?? '');
/** Valid now, or sub judice (could still become valid). Definitively annulled votes never count. */
const eligible = (c: CandidateResult) =>
  c.countedVotes !== null && (c.validShare !== null || subJudice(c));

export function mathFacts(s: Snapshot): MathFact[] {
  const valid = s.votes.valid;
  if (valid === null || s.status !== 'updated') return [];
  // Registered voters of sections not yet counted: the most votes that can still appear.
  const remaining = Math.max(0, s.electorate.total - s.electorate.totalized);
  const pool = s.candidates
    .filter(eligible)
    .sort((a, b) => b.countedVotes! - a.countedVotes! || a.number.localeCompare(b.number));
  const facts: MathFact[] = [];

  // Victory: counted votes above half of the largest valid total still possible.
  const target = raceState(
    s,
    pool.slice(0, 2).map((c) => c.id),
  ).target;
  const winner = pool.find((c) => c.validShare !== null && c.countedVotes! > target);
  if (winner) return [{ kind: 'victory', candidate: winner }];

  // Runoff: nobody can exceed half of the final valid votes, even taking every remaining vote.
  // c_final − V_final/2 ≤ c + R − (V + R)/2 = c − V/2 + R/2 (own sub judice votes added to V).
  const canWin = (c: CandidateResult) => {
    const v = valid + (subJudice(c) ? c.countedVotes! : 0);
    return c.countedVotes! - v / 2 + remaining / 2 > 0;
  };
  if (pool.length > 0 && !pool.some(canWin)) facts.push({ kind: 'runoff' });

  // Finalists: no third candidate can reach the second place even with every remaining vote.
  if (pool.length >= 2) {
    const [first, second, ...rest] = pool;
    if (rest.every((k) => k.countedVotes! + remaining < second.countedVotes!))
      facts.push({ kind: 'finalists', candidates: [first, second] });
  }
  return facts;
}
