import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { ScatterChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, MarkLineComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { asOf, type Layer, type Snapshot } from '../../../../packages/domain/src/index';
import { colors, time } from '../format';
echarts.use([ScatterChart, GridComponent, TooltipComponent, MarkLineComponent, CanvasRenderer]);
export default function TimelineChart({
  snapshots,
  layer,
  scale,
  metric,
  selected,
  onSelect,
}: {
  snapshots: Snapshot[];
  layer: Layer;
  scale: 'time' | 'progress';
  metric: 'share' | 'votes';
  selected: string | null;
  onSelect: (at: string) => void;
}) {
  const element = useRef<HTMLDivElement>(null);
  const coverage = layer === 'coverage',
    voteCount = !coverage && metric === 'votes';
  const series = coverage
    ? [
        {
          name: 'Seções / seções totais',
          color: colors[0],
          values: snapshots.map((s) => s.sections.share),
        },
        {
          name: 'Eleitorado totalizado / total',
          color: colors[1],
          values: snapshots.map((s) => s.electorate.share),
        },
      ]
    : (snapshots.at(-1)?.candidates ?? [])
        .filter((c) => c.destination === 'Válido')
        .map((c, i) => ({
          name: `${c.name}${voteCount ? ' · votos computados' : ' / votos válidos'}`,
          color: colors[i],
          values: snapshots.map((s) => {
            const candidate = s.candidates.find((x) => x.id === c.id);
            return (voteCount ? candidate?.countedVotes : candidate?.validShare) ?? null;
          }),
        }));
  useEffect(() => {
    if (!element.current) return;
    const chart = echarts.init(element.current);
    const x = (s: Snapshot) =>
      scale === 'time'
        ? Date.parse(s.capturedAt)
        : s.sections.share === null
          ? null
          : s.sections.share * 100;
    const selectedSnapshot = selected ? asOf(snapshots, selected) : null;
    const markX = selectedSnapshot ? x(selectedSnapshot) : null;
    const only = snapshots.length === 1 ? Date.parse(snapshots[0].capturedAt) : null;
    chart.setOption({
      animation: false,
      grid: { top: 12, left: 54, right: 25, bottom: 25 },
      tooltip: {
        trigger: 'item',
        renderMode: 'richText',
        formatter: (p: { dataIndex: number; seriesIndex: number }) => {
          const s = snapshots[p.dataIndex],
            line = series[p.seriesIndex],
            value = line?.values[p.dataIndex];
          if (!s || !line || value == null) return 'Sem observação';
          const numerator = coverage
            ? p.seriesIndex === 0
              ? s.sections.totalized
              : s.electorate.totalized
            : s.candidates.filter((c) => c.destination === 'Válido')[p.seriesIndex]?.countedVotes;
          const denominator = coverage
            ? p.seriesIndex === 0
              ? s.sections.total
              : s.electorate.total
            : s.votes.valid;
          const formatted = voteCount
            ? value.toLocaleString('pt-BR') + ' votos'
            : (value * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%';
          return `${line.name}\n${formatted}\n${voteCount ? '' : `${numerator?.toLocaleString('pt-BR') ?? '—'} / ${denominator?.toLocaleString('pt-BR') ?? '—'}\n`}Captura sintética: ${time(s.capturedAt)}\nFonte: ${time(s.sourceGeneratedAt)}`;
        },
      },
      xAxis: {
        type: scale === 'time' ? 'time' : 'value',
        min: scale === 'progress' ? 0 : only === null ? undefined : only - 60_000,
        max: scale === 'progress' ? 100 : only === null ? undefined : only + 60_000,
        splitNumber: 4,
        axisLabel: {
          formatter: (v: number) =>
            scale === 'time' ? time(new Date(v).toISOString()).slice(0, 5) : `${v}%`,
          color: '#7a827b',
          fontSize: 10,
          hideOverlap: true,
        },
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#d9ddd3' } },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: voteCount ? undefined : 100,
        ...(voteCount ? {} : { interval: 50 }),
        axisLabel: {
          formatter: (v: number) =>
            voteCount ? new Intl.NumberFormat('pt-BR', { notation: 'compact' }).format(v) : `${v}%`,
          color: '#7a827b',
          fontSize: 10,
        },
        splitLine: { lineStyle: { color: '#edf0e9', type: 'dashed' } },
      },
      series: series.map((s, i) => ({
        name: s.name,
        type: 'scatter',
        data: s.values.map((v, index) => [
          x(snapshots[index]),
          v === null ? null : voteCount ? v : v * 100,
        ]),
        symbol: coverage && i === 1 ? 'emptyCircle' : 'circle',
        symbolSize: coverage && i === 1 ? 13 : 8,
        itemStyle: { color: s.color },
        markLine:
          markX === null
            ? undefined
            : {
                silent: true,
                symbol: 'none',
                label: { show: false },
                lineStyle: { color: '#a4ada4', type: 'dashed' },
                data: [{ xAxis: markX }],
              },
      })),
    });
    chart.on('click', (p) => {
      const s = snapshots[p.dataIndex];
      if (s) onSelect(s.capturedAt);
    });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(element.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [snapshots, layer, scale, metric, selected, onSelect]);
  return (
    <>
      <div className="chart-key">
        {series.map((s) => (
          <span key={s.name}>
            <i style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
      <div
        ref={element}
        className="timeline-chart"
        role="img"
        aria-label={
          coverage
            ? 'Observações de cobertura por captura'
            : voteCount
              ? 'Votos acumulados por captura'
              : 'Observações de participação nos votos válidos por captura'
        }
      />
    </>
  );
}
