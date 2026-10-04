/**
 * Serpentine race track (boustrophedon): N horizontal straights joined by N − 1 semicircles.
 * Position is linear in votes along the centre line, then offset sideways per lane, so equal
 * votes sit side by side even in curves (never `getPointAtLength` per lane).
 */
export const TRACK = (() => {
  const N = 11,
    X0 = 130,
    X1 = 530,
    R = 30,
    Y0 = 45;
  const L = X1 - X0,
    ESP = 2 * R,
    ARCO = Math.PI * R;
  return {
    N,
    X0,
    X1,
    L,
    R,
    ESP,
    Y0,
    ARCO,
    CL: N * L + (N - 1) * ARCO,
    width: 660,
    height: Y0 + (N - 1) * ESP + 45,
  };
})();

export type Point = { x: number; y: number; straight: boolean };

/** Distance along the centre line (px) for a vote count on a track of `length` votes. */
export function along(votes: number, length: number) {
  return (Math.max(0, Math.min(length, votes)) / length) * TRACK.CL;
}

/** Screen point at distance `u` along the centre line, offset `lane` px to the side. */
export function point(u: number, lane: number): Point {
  const { N, X0, X1, L, R, ESP, Y0, ARCO, CL } = TRACK;
  u = Math.max(0, Math.min(CL, u));
  for (let i = 0; i < N; i++) {
    const d = i % 2 ? -1 : 1,
      y = Y0 + i * ESP;
    // The last straight absorbs float residue: no fall-through past the end.
    if (u <= L || i === N - 1) {
      const v = Math.min(u, L);
      return { x: d > 0 ? X0 + v : X1 - v, y: y + lane * d, straight: true };
    }
    u -= L;
    if (u <= ARCO) {
      const f = u / R;
      if (d > 0) {
        const t = -Math.PI / 2 + f,
          r = R - lane;
        return { x: X1 + r * Math.cos(t), y: y + R + r * Math.sin(t), straight: false };
      }
      const t = -Math.PI / 2 - f,
        r = R + lane;
      return { x: X0 + r * Math.cos(t), y: y + R + r * Math.sin(t), straight: false };
    }
    u -= ARCO;
  }
  /* c8 ignore next */
  throw Error('unreachable');
}

/** Unit normal (pointing to the +lane side) at distance `u`. */
export function normal(u: number) {
  const a = point(u, 0),
    b = point(u, 1);
  return { x: b.x - a.x, y: b.y - a.y };
}

/** SVG path between two vote counts on one lane, sampled every 3 px of centre line. */
export function path(v0: number, v1: number, lane: number, length: number) {
  const a = along(Math.min(v0, v1), length),
    b = along(Math.max(v0, v1), length);
  let d = '';
  for (let k = a; ; k = Math.min(b, k + 3)) {
    const p = point(k, lane);
    d += (d ? 'L' : 'M') + p.x.toFixed(1) + ' ' + p.y.toFixed(1);
    if (k >= b) break;
  }
  return d;
}

/** Perpendicular tick across the track at distance `u`, from offset `from` to `to`. */
export function tick(u: number, from: number, to: number) {
  const a = point(u, from),
    b = point(u, to);
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
}
