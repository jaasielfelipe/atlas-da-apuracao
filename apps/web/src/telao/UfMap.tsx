import { useEffect, useMemo, useRef, useState } from 'react';
import type { FeatureCollection } from 'geojson';
import type { CandidateResult, Snapshot } from '../../../../packages/domain/src/index';
import { camera, lerpBox, shapes, UF_NAMES, type Box } from './geo';
import { Num } from './motion';
import { paint, type Slot } from './paint';

const ASPECT = 600 / 420;
const pct = (v: number, digits = 1) =>
  new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(v * 100) + '%';
const int = (v: number) => new Intl.NumberFormat('pt-BR').format(Math.round(v));
const mi = (v: number) =>
  new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(v / 1_000_000) + ' mi';
const title = (name: string) =>
  name
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|\s)(\p{L})/gu, (_, s: string, l: string) => s + l.toLocaleUpperCase('pt-BR'));
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

export type UfRow = { territoryId: string; snapshot: Snapshot | null };

/** Leader of a UF among all candidates with valid votes; null when nothing is counted. */
export function ufLeader(s: Snapshot | null) {
  if (!s) return null;
  const valid = s.candidates
    .filter((c) => c.validShare !== null && (c.countedVotes ?? 0) > 0)
    .sort((a, b) => b.countedVotes! - a.countedVotes!);
  return valid[0] ?? null;
}

/**
 * State choropleth with a rotating focus: the camera glides to one state at a time and a readout
 * shows its count. Fill = leading candidate's color (heroes) or neutral; strength = share counted.
 * State level only: municipal shapes are never painted from zone data.
 */
export default function UfMap({
  rows,
  focus,
  since,
  ms,
  slotOf,
  heroes,
}: {
  rows: UfRow[];
  focus: string | null;
  since: number;
  ms: number;
  slotOf: (id: string) => Slot | undefined;
  heroes: CandidateResult[];
}) {
  const [geo, setGeo] = useState<ReturnType<typeof shapes> | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch('/maps/br-ufs.geojson', { signal: controller.signal })
      .then((r) => r.json() as Promise<FeatureCollection>)
      .then((c) => setGeo(shapes(c)))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  const byUf = useMemo(() => new Map(rows.map((r) => [r.territoryId, r.snapshot])), [rows]);
  const target = useMemo(() => {
    if (!geo) return null;
    const shape = geo.shapes.find((s) => s.uf === focus);
    return camera(geo.box, shape?.box ?? null, ASPECT);
  }, [geo, focus]);
  const view = useCameraTween(target);
  const focused = focus ? (byUf.get(focus) ?? null) : null;
  const heroIds = heroes.map((h) => h.id);

  return (
    <div className="ufmap">
      <svg
        className="ufmap-svg"
        viewBox={view ? `${view.x} ${view.y} ${view.w} ${view.h}` : '0 0 1 1'}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`Mapa por UF; em foco: ${focus ? UF_NAMES[focus] : '—'}`}
      >
        {geo?.shapes.map((shape) => {
          const s = byUf.get(shape.uf) ?? null;
          const leader = ufLeader(s);
          const slot = leader && heroIds.includes(leader.id) ? slotOf(leader.id) : undefined;
          const counted = s?.sections.share ?? 0;
          const on = shape.uf === focus;
          return (
            <path
              key={shape.uf}
              d={shape.d}
              className={`uf-shape ${on ? 'focus' : ''}`}
              style={{
                fill: leader ? paint(slot).main : 'var(--surface-1)',
                fillOpacity: leader ? 0.28 + 0.72 * counted : 1,
              }}
            />
          );
        })}
        {geo &&
          focus &&
          (() => {
            const shape = geo.shapes.find((s) => s.uf === focus);
            return shape ? <path d={shape.d} className="uf-outline" /> : null;
          })()}
      </svg>
      <div className="readout-col">
        {focus && (
          <FocusReadout
            key={focus}
            uf={focus}
            s={focused}
            heroes={heroes}
            slotOf={slotOf}
            since={since}
            ms={ms}
          />
        )}
        <div className="ufmap-legend">cor: quem lidera · intensidade: % apurado</div>
      </div>
    </div>
  );
}

function FocusReadout({
  uf,
  s,
  heroes,
  slotOf,
  since,
  ms,
}: {
  uf: string;
  s: Snapshot | null;
  heroes: CandidateResult[];
  slotOf: (id: string) => Slot | undefined;
  since: number;
  ms: number;
}) {
  const people = heroes
    .map((h) => s?.candidates.find((c) => c.id === h.id) ?? null)
    .filter((c): c is CandidateResult => c !== null)
    .sort((a, b) => (b.countedVotes ?? 0) - (a.countedVotes ?? 0));
  const lead =
    people.length === 2 &&
    people[0].validShare !== null &&
    people[1].validShare !== null &&
    (people[0].countedVotes ?? 0) > 0
      ? people[0].validShare - people[1].validShare
      : null;
  return (
    <div className="readout">
      <span className="uf-name">{UF_NAMES[uf] ?? uf.toUpperCase()}</span>
      <span className="uf-meta">
        {s?.sections.share == null ? '—' : pct(s.sections.share)} das seções ·{' '}
        {s ? mi(s.electorate.total) : '—'} de eleitores aptos
      </span>
      {people.map((c) => (
        <span
          key={c.id}
          className="uf-hero"
          style={{ ['--mark' as string]: paint(slotOf(c.id)).main }}
        >
          <b>{title(c.name)}</b>
          <Num value={c.validShare} format={(v) => pct(v)} className="pct" />
          <small>{c.countedVotes === null ? '—' : int(c.countedVotes)}</small>
        </span>
      ))}
      <span className="uf-lead">
        {lead === null ? 'sem votos válidos apurados' : `diferença de ${pct(lead)} dos válidos`}
      </span>
      <span className="uf-timer" aria-hidden="true">
        <span key={since} style={{ animationDuration: `${ms}ms` }} />
      </span>
    </div>
  );
}

/** Eases the SVG viewBox toward the target camera (~1.3 s); immediate under reduced motion. */
function useCameraTween(target: Box | null) {
  const [view, setView] = useState<Box | null>(target);
  const shown = useRef<Box | null>(target);
  useEffect(() => {
    if (!target) return;
    if (!shown.current || reduced()) {
      shown.current = target;
      setView(target);
      return;
    }
    const from = shown.current,
      start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 1300);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
      shown.current = lerpBox(from, target, eased);
      setView(shown.current);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return view;
}
