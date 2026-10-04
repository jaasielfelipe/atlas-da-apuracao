import { expect, it } from 'vitest';
import { mathFacts } from './facts';
import type { Snapshot } from '../../../../packages/domain/src/index';

/** registered 1000; `counted` voters in counted sections; 80% turnout; 5% blank+null. */
function snap(counted: number, shares: Record<string, number>, extra: object[] = []) {
  const turnout = Math.round(counted * 0.8),
    blank = Math.round(turnout * 0.03),
    nul = Math.round(turnout * 0.02),
    valid = turnout - blank - nul;
  const candidates = Object.entries(shares).map(([id, share], i) => ({
    id,
    number: String(10 + i),
    name: id,
    countedVotes: Math.round(valid * share),
    validShare: share,
    destination: 'Válido',
  }));
  return {
    status: 'updated',
    electorate: { total: 1000, totalized: counted, installed: counted, turnout },
    votes: { valid, blank, null: nul, annulled: 0, subJudice: 0 },
    candidates: [...candidates, ...extra],
  } as unknown as Snapshot;
}

it('nada é afirmado no início da apuração', () => {
  expect(mathFacts(snap(100, { L: 0.48, F: 0.44, C: 0.08 }))).toEqual([]);
});

it('2º turno confirmado só quando ninguém passa de 50% nem com todos os votos restantes', () => {
  // 990 of 1000 counted: remaining 10 cannot lift 48% above half.
  const late = mathFacts(snap(990, { L: 0.48, F: 0.44, C: 0.08 }));
  expect(late.map((f) => f.kind)).toEqual(['runoff', 'finalists']);
  // 900 counted: 100 remaining voters could still put L above half → no runoff claim, but the
  // third place (≈55 votes + 100) can no longer reach the second (≈301).
  expect(mathFacts(snap(900, { L: 0.48, F: 0.44, C: 0.08 })).map((f) => f.kind)).toEqual([
    'finalists',
  ]);
  // 700 counted: 300 remaining voters could lift even the third place → nothing claimed.
  expect(mathFacts(snap(700, { L: 0.48, F: 0.44, C: 0.08 }))).toEqual([]);
});

it('finalistas definidos quando o 3º não alcança o 2º com todos os votos restantes', () => {
  const facts = mathFacts(snap(800, { L: 0.47, F: 0.45, C: 0.08 }));
  const finalists = facts.find((f) => f.kind === 'finalists');
  expect(finalists && 'candidates' in finalists && finalists.candidates.map((c) => c.id)).toEqual([
    'L',
    'F',
  ]);
  // Close third place: not determined.
  expect(
    mathFacts(snap(800, { L: 0.4, F: 0.31, C: 0.29 })).some((f) => f.kind === 'finalists'),
  ).toBe(false);
});

it('vitória matemática: votos apurados acima da metade de todos os válidos ainda possíveis', () => {
  const facts = mathFacts(snap(990, { L: 0.56, F: 0.36, C: 0.08 }));
  expect(facts).toHaveLength(1);
  expect(facts[0].kind).toBe('victory');
  expect(facts[0].kind === 'victory' && facts[0].candidate.id).toBe('L');
  // Same share, half counted: 56% of counted is still below half of what is still possible.
  expect(
    mathFacts(snap(500, { L: 0.56, F: 0.36, C: 0.08 })).some((f) => f.kind === 'victory'),
  ).toBe(false);
});

it('votos sub judice contam como possivelmente válidos; anulados nunca', () => {
  const subJudice = {
    id: 'S',
    number: '99',
    name: 'S',
    // Large enough that, if its registration became valid, it could still pass half.
    countedVotes: 800,
    validShare: null,
    destination: 'Anulado sub judice',
  };
  // Without S, runoff would be confirmed; S could still become valid and win → no claim.
  const facts = mathFacts(snap(990, { L: 0.48, F: 0.44, C: 0.08 }, [subJudice]));
  expect(facts.some((f) => f.kind === 'runoff')).toBe(false);
  const annulled = { ...subJudice, destination: 'Anulado' };
  expect(
    mathFacts(snap(990, { L: 0.48, F: 0.44, C: 0.08 }, [annulled])).map((f) => f.kind),
  ).toEqual(['runoff', 'finalists']);
});
