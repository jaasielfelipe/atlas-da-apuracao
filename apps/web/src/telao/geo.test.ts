import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { camera, mosaic, shapes, UF_IBGE } from './geo';

const collection = JSON.parse(readFileSync('packages/fixtures/maps/br-ufs.geojson', 'utf8'));

it('projeta as 27 UFs com caixas dentro da caixa nacional', () => {
  const { shapes: all, box } = shapes(collection);
  expect(all.map((s) => s.uf).sort()).toEqual(Object.keys(UF_IBGE).sort());
  for (const s of all) {
    expect(s.d.startsWith('M')).toBe(true);
    expect(s.box.x).toBeGreaterThanOrEqual(box.x - 1e-9);
    expect(s.box.x + s.box.w).toBeLessThanOrEqual(box.x + box.w + 1e-9);
  }
  // North is up: Roraima above Rio Grande do Sul.
  const rr = all.find((s) => s.uf === 'rr')!.box,
    rs = all.find((s) => s.uf === 'rs')!.box;
  expect(rr.y).toBeLessThan(rs.y);
});

it('câmera aproxima a UF em foco, preserva proporção e não sai do país', () => {
  const { shapes: all, box } = shapes(collection);
  const whole = camera(box, null, 1.2);
  expect(whole.w / whole.h).toBeCloseTo(1.2, 6);
  const df = all.find((s) => s.uf === 'df')!.box;
  const near = camera(box, df, 1.2);
  expect(near.w / near.h).toBeCloseTo(1.2, 6);
  expect(near.w).toBeLessThan(whole.w); // zoomed in
  expect(near.w).toBeGreaterThanOrEqual(whole.w / 2.6 - 1e-9); // limited zoom keeps context
  // Focused state inside the frame.
  expect(df.x).toBeGreaterThanOrEqual(near.x);
  expect(df.x + df.w).toBeLessThanOrEqual(near.x + near.w);
});

it('mosaico: larguras proporcionais ao eleitorado, mínimo garantido, soma exata', () => {
  const weights = [34_000_000, 16_000_000, 600_000, 370_000];
  const widths = mosaic(weights, 1000, 4, 20);
  expect(widths.reduce((a, b) => a + b, 0) + 3 * 4).toBeCloseTo(1000, 6);
  expect(widths[2]).toBe(20);
  expect(widths[3]).toBe(20);
  expect(widths[0] / widths[1]).toBeCloseTo(34 / 16, 6);
  expect(mosaic([0, 0], 100, 0, 10)).toEqual([50, 50]);
});
