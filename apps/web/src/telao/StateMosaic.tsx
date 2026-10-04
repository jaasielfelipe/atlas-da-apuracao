import type { CandidateResult } from '../../../../packages/domain/src/index';
import { mosaic, UF_NAMES } from './geo';
import { paint, type Slot } from './paint';
import type { UfRow } from './UfMap';

const WIDTH = 1824,
  GAP = 4,
  MIN = 16;
const pct0 = (v: number) => `${Math.round(v * 100)}%`;

/**
 * One column per UF (and exterior), width proportional to registered voters. Inside, the counted
 * valid votes stacked: Lula, Flávio (hero slots), others. A thin line on top: share of sections
 * counted. The focused UF is highlighted in sync with the map.
 */
export default function StateMosaic({
  rows,
  focus,
  slotOf,
  heroes,
}: {
  rows: UfRow[];
  focus: string | null;
  slotOf: (id: string) => Slot | undefined;
  heroes: CandidateResult[];
}) {
  const ordered = [...rows]
    .filter((r) => r.snapshot)
    .sort((a, b) => b.snapshot!.electorate.total - a.snapshot!.electorate.total);
  const widths = mosaic(
    ordered.map((r) => r.snapshot!.electorate.total),
    WIDTH,
    GAP,
    MIN,
  );
  // Fixed stacking order by slot (b = Lula at the bottom, a = Flávio above), never by rank.
  const stackHeroes = [...heroes].sort((x, y) =>
    (slotOf(y.id) ?? 'z').localeCompare(slotOf(x.id) ?? 'z'),
  );
  return (
    <section className="mosaic" aria-label="Apuração por UF, largura proporcional ao eleitorado">
      <div className="mosaic-cols">
        {ordered.map((r, i) => {
          const s = r.snapshot!;
          const valid = s.votes.valid ?? 0;
          const parts = stackHeroes.map((h) => {
            const c = s.candidates.find((x) => x.id === h.id);
            return {
              id: h.id,
              slot: slotOf(h.id),
              share: valid && c?.countedVotes ? c.countedVotes / valid : 0,
            };
          });
          const rest = valid ? Math.max(0, 1 - parts.reduce((a, p) => a + p.share, 0)) : 0;
          const on = r.territoryId === focus;
          const w = widths[i];
          return (
            <div
              key={r.territoryId}
              className={`col ${on ? 'focus' : ''}`}
              style={{ width: `${w}px` }}
              title={`${UF_NAMES[r.territoryId] ?? r.territoryId}: ${pct0(s.sections.share ?? 0)} apurado`}
            >
              <span className="counted">
                <span style={{ width: `${(s.sections.share ?? 0) * 100}%` }} />
              </span>
              <span className="stack">
                <span className="part rest" style={{ flexGrow: rest }} />
                {[...parts].reverse().map((p) => (
                  <span
                    key={p.id}
                    className="part"
                    style={{ flexGrow: p.share, background: paint(p.slot).main }}
                  />
                ))}
                {!valid && <span className="part none" style={{ flexGrow: 1 }} />}
              </span>
              <span className="lbl">
                {w >= 26 || on ? r.territoryId.toUpperCase().replace('ZZ', 'EXT') : ''}
              </span>
              <span className="pc">{w >= 44 || on ? pct0(s.sections.share ?? 0) : ''}</span>
            </div>
          );
        })}
      </div>
      <p className="mosaic-note">
        Largura de cada UF proporcional aos eleitores aptos · colunas: divisão dos votos válidos já
        apurados · linha superior: seções apuradas
      </p>
    </section>
  );
}
