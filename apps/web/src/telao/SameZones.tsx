import type { ZoneComparison } from '../../../../packages/domain/src/zones';
import { Rolling } from './motion';
import { paint } from './paint';

type Point = Omit<ZoneComparison, 'rows'>;
const OFFICIAL = [
  { key: 'lula_haddad', slot: 'b', name: 'Lula', past: 'Lula em 2022', older: 'Haddad em 2018' },
  { key: 'bolsonaro', slot: 'a', name: 'Bolsonaro', past: 'Jair em 2022', older: 'Jair em 2018' },
] as const;
// Fixture/simulated numbers never appear next to real names.
const SYNTHETIC = [
  { key: 'lula_haddad', slot: 'b', name: 'Série L', past: 'sintético 2022', older: 'sint. 2018' },
  { key: 'bolsonaro', slot: 'a', name: 'Série B', past: 'sintético 2022', older: 'sint. 2018' },
] as const;
type Series = typeof OFFICIAL | typeof SYNTHETIC;
const pct = (v: number) =>
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
    v * 100,
  ) + '%';
const int = (v: number) => new Intl.NumberFormat('pt-BR').format(Math.round(v));
const pp = (v: number) =>
  (v > 0 ? '+' : v < 0 ? '−' : '±') +
  new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(
    Math.abs(v),
  ) +
  ' p.p.';
const time = (iso: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));

/**
 * "If the last election had been counted in the same zones counted so far today": shares and votes
 * of each series in the cohort of whole zones complete in 2026 and reconciled with 2018/2022.
 * Never a national estimate; the cohort size is always on screen.
 */
export default function SameZones({
  comparison,
  timeline,
  unavailable,
  synthetic,
}: {
  comparison: ZoneComparison | null;
  timeline: Point[];
  unavailable: string | null;
  synthetic: boolean;
}) {
  const SERIES: Series = synthetic ? SYNTHETIC : OFFICIAL;
  const cohort = comparison?.coverage.comparable ?? 0;
  const points = timeline.filter((p) => p.coverage.comparable > 0);
  return (
    <section className="card same-zones" aria-label="Mesmas zonas: 2026 e eleições anteriores">
      <header className="card-head">
        <h2>Mesmas zonas, outra eleição</h2>
        <p>
          Se 2022 tivesse sido apurada só nas zonas já concluídas hoje.{' '}
          <strong>Não é estimativa do resultado nacional.</strong>
        </p>
      </header>
      {unavailable || !comparison ? (
        <p className="empty">{unavailable ?? 'Aguardando a primeira comparação.'}</p>
      ) : cohort === 0 ? (
        <p className="empty">
          Nenhuma zona eleitoral inteira concluída e conciliada ainda.{' '}
          <span className="muted">
            {int(comparison.coverage.completed)} zonas concluídas ·{' '}
            {comparison.coverage.expected === null ? '—' : int(comparison.coverage.expected)}{' '}
            esperadas
          </span>
        </p>
      ) : (
        <>
          <div className="cohort-line">
            <Rolling value={cohort} format={int} className="cohort-count" />
            <span>
              zonas na comparação
              <small>
                de {comparison.coverage.expected === null ? '—' : int(comparison.coverage.expected)}{' '}
                · {int(comparison.shares[2026].valid)} votos válidos em 2026
              </small>
            </span>
          </div>
          <div className="sz-rows">
            {SERIES.map((s) => {
              const now = comparison.shares[2026][s.key],
                then = comparison.shares[2022][s.key],
                old = comparison.shares[2018][s.key];
              const p = paint(s.slot);
              return (
                <div className="sz-row" key={s.key}>
                  <span className="sz-swatch" style={{ background: p.main }} />
                  <div className="sz-name">
                    {s.name}
                    <small>2026 · mesmas zonas</small>
                  </div>
                  <div className="sz-now">
                    <Rolling value={now} format={pct} />
                    <small>
                      {now === null ? '—' : int(now * comparison.shares[2026].valid)} votos
                    </small>
                  </div>
                  <div className="sz-then">
                    <span>{then === null ? '—' : pct(then)}</span>
                    <small>{s.past}</small>
                  </div>
                  <div className="sz-delta">
                    {now === null || then === null ? '—' : pp((now - then) * 100)}
                    <small>
                      {s.older}: {old === null ? '—' : pct(old)}
                    </small>
                  </div>
                </div>
              );
            })}
          </div>
          <Chart points={points} series={SERIES} />
        </>
      )}
    </section>
  );
}

function Chart({ points, series: SERIES }: { points: Point[]; series: Series }) {
  if (points.length < 2)
    return <p className="empty small">A linha do tempo aparece a partir da segunda captura.</p>;
  const W = 600,
    H = 150,
    left = 46,
    right = 120,
    top = 12,
    bottom = 26;
  const values = points.flatMap((p) =>
    SERIES.flatMap((s) => [p.shares[2026][s.key], p.shares[2022][s.key]]),
  );
  const finite = values.filter((v): v is number => v !== null);
  const lo = Math.max(0, Math.floor((Math.min(...finite) * 100 - 3) / 5) * 5),
    hi = Math.min(100, Math.ceil((Math.max(...finite) * 100 + 3) / 5) * 5);
  const t0 = Date.parse(points[0].at),
    t1 = Date.parse(points.at(-1)!.at);
  const x = (iso: string) =>
    left + ((Date.parse(iso) - t0) / Math.max(1, t1 - t0)) * (W - left - right);
  const y = (v: number) => top + (1 - (v * 100 - lo) / (hi - lo)) * (H - top - bottom);
  const line = (year: 2026 | 2022, key: Series[number]['key']) =>
    points
      .filter((p) => p.shares[year][key] !== null)
      .map((p, i) => `${i ? 'L' : 'M'}${x(p.at).toFixed(1)} ${y(p.shares[year][key]!).toFixed(1)}`)
      .join('');
  const grid = [];
  for (let g = lo; g <= hi; g += 5) grid.push(g);
  const last = points.at(-1)!;
  const maxCohort = Math.max(...points.map((p) => p.coverage.comparable));
  return (
    <figure className="sz-chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label="Participação nas mesmas zonas, 2026 e 2022, por captura"
      >
        {grid.map((g) => (
          <g key={g}>
            <line x1={left} x2={W - right} y1={y(g / 100)} y2={y(g / 100)} className="grid" />
            <text x={left - 8} y={y(g / 100) + 4} textAnchor="end" className="axis">
              {g}%
            </text>
          </g>
        ))}
        <text x={left} y={H - 6} className="axis">
          {time(points[0].at)}
        </text>
        <text x={W - right} y={H - 6} textAnchor="end" className="axis">
          {time(last.at)}
        </text>
        {SERIES.map((s) => (
          <g key={s.key} style={{ stroke: paint(s.slot).main }}>
            <path d={line(2022, s.key)} className="sz-line past" />
            <path d={line(2026, s.key)} className="sz-line now" />
          </g>
        ))}
        {SERIES.map((s) => {
          const now = last.shares[2026][s.key];
          return now === null ? null : (
            <circle
              key={s.key}
              cx={x(last.at)}
              cy={y(now)}
              r={5}
              className="sz-dot"
              style={{ fill: paint(s.slot).main }}
            />
          );
        })}
        {labels(SERIES, last, y).map((l) => (
          <text
            key={l.key}
            x={x(last.at) + 10}
            y={l.y + 4}
            className={l.past ? 'sz-label past' : 'sz-label'}
          >
            {l.text}
          </text>
        ))}
      </svg>
      <div className="sz-cohort" aria-label="Zonas na comparação por captura">
        {points.map((p) => (
          <span
            key={p.at}
            title={`${time(p.at)}: ${int(p.coverage.comparable)} zonas`}
            style={{ height: `${Math.max(6, (p.coverage.comparable / maxCohort) * 100)}%` }}
          />
        ))}
      </div>
      <figcaption>
        Cheias: 2026 · tracejadas: 2022 nas mesmas zonas · barras: zonas na comparação a cada
        captura.
      </figcaption>
    </figure>
  );
}

/** End labels for the four lines, nudged apart (≥ 15 px) so close values never overlap. */
function labels(SERIES: Series, last: Point, y: (v: number) => number) {
  const out = SERIES.flatMap((s) =>
    ([2026, 2022] as const)
      .filter((year) => last.shares[year][s.key] !== null)
      .map((year) => ({
        key: `${s.key}${year}`,
        text: `${s.name} ${year}`,
        past: year === 2022,
        y: y(last.shares[year][s.key]!),
      })),
  ).sort((a, b) => a.y - b.y);
  for (let i = 1; i < out.length; i++) out[i].y = Math.max(out[i].y, out[i - 1].y + 15);
  return out;
}
