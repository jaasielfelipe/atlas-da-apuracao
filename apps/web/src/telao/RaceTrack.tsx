import { useMemo } from 'react';
import type { CandidateResult } from '../../../../packages/domain/src/index';
import { TRACK, along, path, point, tick } from './geometry';
import { useTween } from './motion';
import type { Slot } from './paint';
import { paint } from './paint';
import type { RaceState } from './race';

export type Runner = {
  candidate: CandidateResult;
  slot: Slot | undefined;
  votes: number;
  /** Start of the highlighted increment (previous bulletin), or `votes` when none. */
  from: number;
  lane: -8 | 8;
};

const mi = (v: number) => `${Math.round(v / 1_000_000)} mi`;

/**
 * Fixed-length serpentine track (0 → 55% of registered voters), linear in absolute votes.
 * Layers, bottom to top: asphalt, zone beyond the adjusted target, lanes, ticks, scale labels,
 * progress, last increment, target trail, fixed line, adjusted target, finish labels, heads.
 */
export default function RaceTrack({
  race,
  previousTarget,
  runners,
}: {
  race: RaceState;
  previousTarget: number | null;
  runners: Runner[];
}) {
  const length = race.trackVotes;
  const target = useTween(race.target);
  const heads = [useTween(runners[0]?.votes ?? 0), useTween(runners[1]?.votes ?? 0)];

  const statics = useMemo(() => {
    const step = 500_000;
    const ticks: { key: number; line: ReturnType<typeof tick>; major: boolean }[] = [];
    const labels: { key: number; x: number; y: number; text: string }[] = [];
    const fixedU = along(race.fixedLine, length);
    for (let v = step; v < length; v += step) {
      const u = along(v, length),
        major = v % 1_000_000 === 0;
      ticks.push({ key: v, major, line: major ? tick(u, -17, 17) : tick(u, -17, -13) });
      if (v % 2_000_000 === 0 && Math.abs(u - fixedU) > 45) {
        const p = point(u, 0);
        if (p.straight) labels.push({ key: v, x: p.x, y: p.y - 21, text: mi(v) });
      }
    }
    return {
      ticks,
      labels,
      asphalt: path(0, length, 0, length),
      lanes: [path(0, length, -8, length), path(0, length, 8, length)],
      fixed: tick(fixedU, -21, 21),
      fixedU,
    };
  }, [length, race.fixedLine]);

  const targetU = along(target, length);
  const targetTick = tick(targetU, -21, 21);
  const close = Math.abs(targetU - statics.fixedU) < 110;
  const label = (u: number) => {
    const p = point(u, 0);
    return { x: p.x, y: p.y - 26 };
  };
  const fixedLabel = label(statics.fixedU),
    targetLabel = label(targetU),
    jointLabel = label((targetU + statics.fixedU) / 2);
  const trail =
    previousTarget !== null && previousTarget > race.target
      ? path(race.target, previousTarget, 0, length)
      : null;

  return (
    <svg
      className="track"
      viewBox={`0 0 ${TRACK.width} ${TRACK.height}`}
      role="img"
      aria-label={`Pista da apuração: ${runners
        .map((r) => `${r.candidate.name} ${r.votes.toLocaleString('pt-BR')} votos`)
        .join(', ')}; meta ajustada ${race.toWin.toLocaleString('pt-BR')} votos.`}
    >
      <path d={statics.asphalt} className="track-asphalt" />
      <path d={path(target, length, 0, length)} className="track-beyond" />
      {statics.lanes.map((d, i) => (
        <path key={i} d={d} className="track-lane" />
      ))}
      {statics.ticks.map((t) => (
        <line key={t.key} {...t.line} className={t.major ? 'track-tick major' : 'track-tick'} />
      ))}
      {statics.labels
        .filter((l) => Math.abs(along(l.key, length) - targetU) > 45)
        .map((l) => (
          <text key={l.key} x={l.x} y={l.y} className="track-scale" textAnchor="middle">
            {l.text}
          </text>
        ))}
      {runners.map((r, i) => {
        const p = paint(r.slot);
        const shown = heads[i];
        const start = Math.min(r.from, shown);
        return (
          <g key={r.candidate.id}>
            {start > 0 && (
              <path
                d={path(0, start, r.lane, length)}
                className="track-progress"
                style={{ stroke: p.main }}
              />
            )}
            {shown > start && (
              <path
                d={path(start, shown, r.lane, length)}
                className="track-increment"
                style={{ stroke: p.inc }}
              />
            )}
          </g>
        );
      })}
      {trail && <path d={trail} className="track-trail" />}
      <line {...statics.fixed} className="track-fixed" />
      <line {...targetTick} className="track-target" />
      {close ? (
        <text x={jointLabel.x} y={jointLabel.y} className="track-finish" textAnchor="middle">
          chegadas
        </text>
      ) : (
        <>
          <text x={fixedLabel.x} y={fixedLabel.y} className="track-finish" textAnchor="middle">
            50% aptos
          </text>
          <text
            x={targetLabel.x}
            y={targetLabel.y}
            className="track-finish target"
            textAnchor="middle"
          >
            meta ajustada
          </text>
        </>
      )}
      {runners.map((r, i) => {
        const head = point(along(heads[i], length), r.lane);
        return (
          <g key={r.candidate.id} className="track-head">
            <circle
              cx={head.x}
              cy={head.y}
              r={11}
              className="track-head-halo"
              style={{ fill: paint(r.slot).main }}
            />
            <circle
              cx={head.x}
              cy={head.y}
              r={6.5}
              className="track-head-dot"
              style={{ fill: paint(r.slot).main }}
            />
          </g>
        );
      })}
    </svg>
  );
}
