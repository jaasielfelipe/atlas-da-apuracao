import type { FeatureCollection, Geometry } from 'geojson';

/** IBGE UF codes (fixed by IBGE); the TSE catalog carries IBGE codes only for municipalities. */
export const UF_IBGE: Record<string, string> = {
  ro: '11',
  ac: '12',
  am: '13',
  rr: '14',
  pa: '15',
  ap: '16',
  to: '17',
  ma: '21',
  pi: '22',
  ce: '23',
  rn: '24',
  pb: '25',
  pe: '26',
  al: '27',
  se: '28',
  ba: '29',
  mg: '31',
  es: '32',
  rj: '33',
  sp: '35',
  pr: '41',
  sc: '42',
  rs: '43',
  ms: '50',
  mt: '51',
  go: '52',
  df: '53',
};
const IBGE_UF = Object.fromEntries(Object.entries(UF_IBGE).map(([uf, code]) => [code, uf]));

export const UF_NAMES: Record<string, string> = {
  ac: 'Acre',
  al: 'Alagoas',
  ap: 'Amapá',
  am: 'Amazonas',
  ba: 'Bahia',
  ce: 'Ceará',
  df: 'Distrito Federal',
  es: 'Espírito Santo',
  go: 'Goiás',
  ma: 'Maranhão',
  mt: 'Mato Grosso',
  ms: 'Mato Grosso do Sul',
  mg: 'Minas Gerais',
  pa: 'Pará',
  pb: 'Paraíba',
  pr: 'Paraná',
  pe: 'Pernambuco',
  pi: 'Piauí',
  rj: 'Rio de Janeiro',
  rn: 'Rio Grande do Norte',
  rs: 'Rio Grande do Sul',
  ro: 'Rondônia',
  rr: 'Roraima',
  sc: 'Santa Catarina',
  sp: 'São Paulo',
  se: 'Sergipe',
  to: 'Tocantins',
  zz: 'Exterior',
};

export type Box = { x: number; y: number; w: number; h: number };
export type UfShape = { uf: string; d: string; box: Box };

/**
 * Equirectangular projection with the cosine of Brazil's mid latitude (−15°): adequate for a
 * national choropleth, no projection library needed. Output units: degrees of longitude.
 */
const K = Math.cos((-15 * Math.PI) / 180);
const project = ([lon, lat]: number[]) => [lon * K, -lat];

export function shapes(collection: FeatureCollection): { shapes: UfShape[]; box: Box } {
  const all: UfShape[] = [];
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const f of collection.features) {
    const uf = IBGE_UF[String(f.properties?.codarea)];
    if (!uf) continue;
    const g = f.geometry as Exclude<Geometry, { type: 'GeometryCollection' }>;
    const polygons =
      g.type === 'Polygon'
        ? [g.coordinates as number[][][]]
        : g.type === 'MultiPolygon'
          ? (g.coordinates as number[][][][])
          : [];
    let d = '',
      x0 = Infinity,
      y0 = Infinity,
      x1 = -Infinity,
      y1 = -Infinity;
    for (const polygon of polygons)
      for (const ring of polygon) {
        ring.forEach((c, i) => {
          const [x, y] = project(c);
          d += `${i ? 'L' : 'M'}${x.toFixed(3)} ${y.toFixed(3)}`;
          x0 = Math.min(x0, x);
          y0 = Math.min(y0, y);
          x1 = Math.max(x1, x);
          y1 = Math.max(y1, y);
        });
        d += 'Z';
      }
    all.push({ uf, d, box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } });
    minX = Math.min(minX, x0);
    minY = Math.min(minY, y0);
    maxX = Math.max(maxX, x1);
    maxY = Math.max(maxY, y1);
  }
  return { shapes: all, box: { x: minX, y: minY, w: maxX - minX, h: maxY - minY } };
}

/**
 * Camera for the rotating focus: zooms toward the focused state but never further than `maxZoom`
 * and never so far that the country leaves the frame entirely; keeps the frame's aspect ratio.
 */
export function camera(national: Box, focus: Box | null, aspect: number, maxZoom = 2.6): Box {
  const fit = (b: Box, pad: number): Box => {
    const w = b.w * pad,
      h = b.h * pad;
    const width = Math.max(w, h * aspect),
      height = width / aspect;
    return { x: b.x + b.w / 2 - width / 2, y: b.y + b.h / 2 - height / 2, w: width, h: height };
  };
  const whole = fit(national, 1.04);
  if (!focus) return whole;
  const near = fit(focus, 3.2);
  const scale = Math.min(maxZoom, whole.w / near.w);
  const w = whole.w / Math.max(1, scale),
    h = w / aspect;
  // Centre between the state and the country, so neighbours stay in view.
  const cx = focus.x + focus.w / 2,
    cy = focus.y + focus.h / 2;
  const x = Math.min(Math.max(cx - w / 2, whole.x - w * 0.1), whole.x + whole.w - w * 0.9);
  const y = Math.min(Math.max(cy - h / 2, whole.y - h * 0.1), whole.y + whole.h - h * 0.9);
  return { x, y, w, h };
}

/** Linear interpolation between two camera boxes. */
export const lerpBox = (a: Box, b: Box, t: number): Box => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  w: a.w + (b.w - a.w) * t,
  h: a.h + (b.h - a.h) * t,
});

/**
 * Mosaic layout: column widths proportional to registered voters, with a minimum width so tiny
 * electorates stay visible; the minimum is taken from the others so the total stays exact.
 */
export function mosaic(weights: number[], total: number, gap: number, minWidth: number) {
  const usable = total - gap * Math.max(0, weights.length - 1);
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum) return weights.map(() => usable / Math.max(1, weights.length));
  let widths = weights.map((w) => (w / sum) * usable);
  const small = widths.map((w) => w < minWidth);
  const reserved = small.filter(Boolean).length * minWidth;
  const rest = weights.filter((_, i) => !small[i]).reduce((a, b) => a + b, 0);
  widths = weights.map((w, i) => (small[i] ? minWidth : (w / rest) * (usable - reserved)));
  return widths;
}
