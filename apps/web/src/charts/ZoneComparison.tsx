import { useEffect, useRef, useState } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import {
  classes,
  years,
  type ZoneComparison as Comparison,
} from '../../../../packages/domain/src/zones';
import { api, percent, time } from '../format';
echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, CanvasRenderer]);
const labels = {
  bolsonaro: 'Bolsonaro',
  lula_haddad: 'Lula / Haddad',
  outros: 'Outros',
  empate: 'Empate',
};
type Response = { comparison: Comparison | null; timeline: Comparison[]; method: string };
export default function ZoneComparison({
  territory,
  at,
  revision,
  onSelect,
}: {
  territory: string;
  at: string | null;
  revision: number;
  onSelect: (at: string) => void;
}) {
  const [data, setData] = useState<Response | null>(null),
    [error, setError] = useState('');
  const [year, setYear] = useState<2018 | 2022>(2018),
    [filter, setFilter] = useState(''),
    [descending, setDescending] = useState(false);
  const chart = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let active = true;
    setData(null);
    setError('');
    const q = new URLSearchParams({ territory });
    if (at) q.set('at', at);
    api<Response>(`/api/v1/comparison?${q}`)
      .then((r) => {
        if (active) setData(r);
      })
      .catch(() => {
        if (active) setError('Comparação indisponível neste instante. Tente novamente.');
      });
    return () => {
      active = false;
    };
  }, [territory, at, revision]);
  useEffect(() => {
    if (!chart.current || !data?.timeline.length) return;
    const instance = echarts.init(chart.current);
    instance.setOption({
      color: ['#1f6557', '#ad7828', '#6a7191', '#9a5674'],
      tooltip: { trigger: 'item' },
      legend: { bottom: 0 },
      grid: { left: 45, right: 20, top: 20, bottom: 70 },
      xAxis: { type: 'category', data: data.timeline.map((c) => time(c.at)) },
      yAxis: { type: 'value', minInterval: 1, name: 'Unidades' },
      series: classes.map((c) => ({
        name: labels[c],
        type: 'line',
        step: 'end',
        connectNulls: false,
        symbolSize: 10,
        data: data.timeline.map((t) => t.leadership[2026][c]),
      })),
    });
    instance.on('click', (p) => {
      const t = data.timeline[p.dataIndex];
      if (t) onSelect(t.at);
    });
    const resize = new ResizeObserver(() => instance.resize());
    resize.observe(chart.current);
    return () => {
      resize.disconnect();
      instance.dispose();
    };
  }, [data, onSelect]);
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p className="chart-empty">Carregando comparação sintética…</p>;
  const c = data.comparison;
  if (!c) return <p className="chart-empty">Sem cadastro capturado neste instante. —</p>;
  const unit = c.unitKind === 'whole_zone' ? 'zonas eleitorais' : 'unidades município–zona';
  const transition = c.transitions[year];
  const rows = c.rows
    .filter((r) => `${r.key} ${r.status}`.includes(filter.toLowerCase()))
    .sort((a, b) => (descending ? b.key.localeCompare(a.key) : a.key.localeCompare(b.key)));
  return (
    <div className="zone-comparison">
      <div className="zone-title">
        <div>
          <span className="eyebrow">FIXTURE · DADOS SINTÉTICOS</span>
          <h2>Comparação por {unit}</h2>
        </div>
        <span className="zone-cohort" data-testid="zone-cohort">
          {c.coverage.comparable} comparáveis / {c.coverage.completed} concluídas /{' '}
          {c.coverage.expected ?? '—'} esperadas
        </span>
      </div>
      <p className="footnote">
        {data.method} As contagens abaixo não são um resultado agregado oficial.
      </p>
      <div className="zone-grid">
        <section>
          <h3>Lideranças na mesma coorte</h3>
          <div className="zone-scroll">
            <table>
              <caption>Primeiro colocado entre todos os candidatos válidos</caption>
              <thead>
                <tr>
                  <th>Classe</th>
                  {years.map((y) => (
                    <th key={y}>{y}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {classes.map((cl) => (
                  <tr key={cl}>
                    <th>{labels[cl]}</th>
                    {years.map((y) => (
                      <td key={y}>{c.leadership[y][cl]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3>Participações ponderadas</h3>
          <div className="zone-scroll">
            <table>
              <caption>Soma dos votos da série / soma dos válidos</caption>
              <thead>
                <tr>
                  <th>Série</th>
                  {years.map((y) => (
                    <th key={y}>{y}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(['bolsonaro', 'lula_haddad'] as const).map((cl) => (
                  <tr key={cl}>
                    <th>{labels[cl]}</th>
                    {years.map((y) => (
                      <td key={y}>{percent(c.shares[y][cl])}</td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th>Válidos</th>
                  {years.map((y) => (
                    <td key={y}>{c.shares[y].valid.toLocaleString('pt-BR')}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <section>
          <div className="zone-title">
            <h3>Transição territorial</h3>
            <select
              aria-label="Ano da matriz"
              value={year}
              onChange={(e) => setYear(Number(e.target.value) as 2018 | 2022)}
            >
              <option value="2018">2018 → 2026</option>
              <option value="2022">2022 → 2026</option>
            </select>
          </div>
          <p>
            Bolsonaro → Lula/Haddad: <b>{transition.bolsonaroToLula}</b> · Lula/Haddad → Bolsonaro:{' '}
            <b>{transition.lulaToBolsonaro}</b>
          </p>
          <div className="zone-scroll">
            <table data-testid="transition-matrix">
              <caption>
                Linhas: {year} · colunas: 2026 · unidade: {unit}
              </caption>
              <thead>
                <tr>
                  <th>{year} ↓ / 2026 →</th>
                  {classes.map((cl) => (
                    <th key={cl}>{labels[cl]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {classes.map((cl, i) => (
                  <tr key={cl}>
                    <th>{labels[cl]}</th>
                    {classes.map((to, j) => (
                      <td className={i + j === 1 ? 'direct-transition' : ''} key={to}>
                        {transition.matrix[i][j]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="footnote">
            Trocas entre lideranças territoriais; não representam transferências individuais de
            votos.
          </p>
          <p>
            Δ Bolsonaro:{' '}
            {transition.deltas.bolsonaro === null
              ? '—'
              : transition.deltas.bolsonaro.toFixed(2) + ' pp'}{' '}
            · Δ Lula/Haddad:{' '}
            {transition.deltas.lula_haddad === null
              ? '—'
              : transition.deltas.lula_haddad.toFixed(2) + ' pp'}
          </p>
          <p className="footnote">
            Saldos (entradas − saídas):{' '}
            {classes.map((cl) => `${labels[cl]} ${transition.net[cl]}`).join(' · ')}
          </p>
        </section>
      </div>
      <h3>Lideranças observadas em 2026</h3>
      <div ref={chart} className="zone-chart" aria-label="Timeline de contagens de liderança" />
      <p className="footnote">
        Pontos capturados até o instante selecionado; sem interpolação. Retificações podem reduzir a
        coorte.
      </p>
      <div className="zone-title">
        <h3>Inclusões e exclusões</h3>
        <input
          aria-label="Filtrar unidades da coorte"
          placeholder="Código ou estado"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="zone-scroll">
        <table>
          <thead>
            <tr>
              <th>
                <button onClick={() => setDescending(!descending)}>
                  Unidade {descending ? '↓' : '↑'}
                </button>
              </th>
              <th>Estado</th>
              <th>Segmentos</th>
              {years.map((y) => (
                <th key={y}>Líder / válidos {y}</th>
              ))}
              <th>Última captura zonal</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <td>{r.key.toUpperCase()}</td>
                <td>
                  {r.status === 'included'
                    ? 'Incluída'
                    : r.status === 'incomplete'
                      ? 'Incompleta'
                      : r.status}
                </td>
                <td>{r.segments.length}</td>
                {years.map((y) => (
                  <td key={y}>
                    {r.values
                      ? `${labels[r.values[y].leader]} / ${r.values[y].valid.toLocaleString('pt-BR')}`
                      : '—'}
                  </td>
                ))}
                <td>{r.observedAt ? time(r.observedAt) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <p>Nenhuma unidade neste recorte da fixture.</p>}
    </div>
  );
}
