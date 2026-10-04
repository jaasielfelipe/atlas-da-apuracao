import type { CandidateResult } from '../../../../packages/domain/src/index';
import { mosaic, UF_NAMES } from './geo';

/** Regions in the order requested for the big screen; exterior last. */
export const REGIONS: { name: string; ufs: string[] }[] = [
  { name: 'Sul', ufs: ['pr', 'rs', 'sc'] },
  { name: 'Sudeste', ufs: ['sp', 'mg', 'rj', 'es'] },
  { name: 'Centro-Oeste', ufs: ['go', 'mt', 'ms', 'df'] },
  { name: 'Norte', ufs: ['pa', 'am', 'ro', 'to', 'ac', 'ap', 'rr'] },
  { name: 'Nordeste', ufs: ['ba', 'pe', 'ce', 'ma', 'pb', 'rn', 'al', 'pi', 'se'] },
  { name: 'Ext.', ufs: ['zz'] },
];
const REGION_GAP = 18;
import { paint, type Slot } from './paint';
import type { UfRow } from './UfMap';
import type { Changes } from './useTelao';

const WIDTH = 1824,
  GAP = 4,
  MIN = 22;
const pct0 = (v: number) => `${Math.round(v * 100)}%`;

/**
 * One column per UF (and exterior), width proportional to registered voters. Inside, the counted
 * valid votes stacked: Lula, Flávio (hero slots), others. A thin line on top: share of sections
 * counted. The focused UF is highlighted in sync with the map.
 */
export default function StateMosaic({
  rows,
  focus,
  changes,
  slotOf,
  heroes,
}: {
  rows: UfRow[];
  focus: string | null;
  /** States changed by the latest observed bulletin (light, fading highlight). */
  changes?: Changes;
  slotOf: (id: string) => Slot | undefined;
  heroes: CandidateResult[];
}) {
  // Region by region (fixed order), largest electorate first inside each region.
  const byId = new Map(rows.filter((r) => r.snapshot).map((r) => [r.territoryId, r]));
  const groups = REGIONS.map((g) => ({
    name: g.name,
    rows: g.ufs
      .map((uf) => byId.get(uf))
      .filter((r): r is UfRow => !!r)
      .sort((a, b) => b.snapshot!.electorate.total - a.snapshot!.electorate.total),
  })).filter((g) => g.rows.length);
  const ordered = groups.flatMap((g) => g.rows);
  const widths = mosaic(
    ordered.map((r) => r.snapshot!.electorate.total),
    WIDTH - REGION_GAP * Math.max(0, groups.length - 1),
    GAP,
    MIN,
  );
  const widthOf = new Map(ordered.map((r, i) => [r.territoryId, widths[i]]));
  // Fixed stacking order by slot (b = Lula at the bottom, a = Flávio above), never by rank.
  const stackHeroes = [...heroes].sort((x, y) =>
    (slotOf(y.id) ?? 'z').localeCompare(slotOf(x.id) ?? 'z'),
  );
  return (
    <section className="mosaic" aria-label="Apuração por UF, largura proporcional ao eleitorado">
      <div className="mosaic-cols">
        {groups.map((g) => {
          const electorate = g.rows.reduce((a, r) => a + r.snapshot!.electorate.total, 0);
          const sections = g.rows.reduce((a, r) => a + r.snapshot!.sections.total, 0);
          const counted = g.rows.reduce((a, r) => a + r.snapshot!.sections.totalized, 0);
          return (
            <div key={g.name} className="region">
              <span className="region-name">
                {g.name}
                {g.name !== 'Ext.' && (
                  <small>
                    {' '}
                    {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(
                      electorate / 1_000_000,
                    )}{' '}
                    mi · {sections ? pct0(counted / sections) : '—'}
                  </small>
                )}
              </span>
              <div className="region-cols">
                {g.rows.map((r) => {
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
                  const fresh = !!changes?.items.some((c) => c.id === r.territoryId);
                  const w = widthOf.get(r.territoryId)!;
                  return (
                    <div
                      key={`${r.territoryId}-${fresh ? changes!.at : 0}`}
                      className={`col ${on ? 'focus' : ''} ${fresh ? 'fresh' : ''}`}
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
                      <span className={w < 34 ? 'lbl narrow' : 'lbl'}>
                        {r.territoryId === 'zz'
                          ? w < 34
                            ? 'EX'
                            : 'EXT'
                          : r.territoryId.toUpperCase()}
                      </span>
                      <span className="pc">{w >= 30 || on ? pct0(s.sections.share ?? 0) : ''}</span>
                    </div>
                  );
                })}
              </div>
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
