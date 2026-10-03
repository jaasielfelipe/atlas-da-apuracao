import { test, expect } from '@playwright/test';
import { readFileSync, mkdirSync } from 'node:fs';
import { normalizeEA20 } from '../../packages/tse/src/index';
test('acervo simulado separado: aviso, resultado, cobertura e mobile', async ({ page }) => {
  const raw = readFileSync('packages/fixtures/simulado/ea20-president-br.json', 'utf8');
  const snapshot = normalizeEA20(JSON.parse(raw), {
    environment: 'simulated',
    electionId: '21270',
    office: 'president',
    territory: {
      id: 'br',
      kind: 'br',
      name: 'Brasil',
      uf: null,
      tseCode: null,
      ibgeCode: null,
      parentId: null,
    },
    sourceUrl:
      'https://resultados-sim.tse.jus.br/simulado/simulado2026/ele2026/21270/dados/br/br-c0001-e021270-u.json',
    capturedAt: '2026-10-03T18:00:00.000Z',
    raw,
  });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/v1/simulated/archive', (r) =>
    r.fulfill({
      json: {
        environment: 'simulated',
        lastObservation: snapshot.capturedAt,
        coverage: {
          observedSegments: 22,
          expectedSegments: 6289,
          completeSegments: 22,
          completeZones: 8,
          expectedZones: 2639,
        },
        territories: [{ id: 'br', kind: 'br', name: 'Brasil' }],
      },
    }),
  );
  await page.route('**/api/v1/simulated/results?*', (r) =>
    r.fulfill({ json: { environment: 'simulated', snapshots: [snapshot] } }),
  );
  await page.goto('/simulated');
  await expect(page.getByRole('heading', { name: 'Acervo simulado', exact: true })).toBeVisible();
  await expect(page.getByText('Não são resultados oficiais.', { exact: true })).toBeVisible();
  await expect(
    page.getByText('indisponível para os candidatos do simulado', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(snapshot.candidates.length);
  await expect(page.getByLabel('Captura do agregado')).toBeDisabled();
  mkdirSync('docs/evidence', { recursive: true });
  await page.screenshot({ path: 'docs/evidence/simulated-archive-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.screenshot({ path: 'docs/evidence/simulated-archive-mobile.png', fullPage: true });
  await page.unroute('**/api/v1/simulated/results?*');
  await page.route('**/api/v1/simulated/results?*', (r) =>
    r.fulfill({ status: 503, json: { error: 'Acervo temporariamente indisponível' } }),
  );
  await page.getByRole('button', { name: 'Atualizar acervo' }).click();
  await expect(page.getByRole('alert')).toContainText('temporariamente indisponível');
  await expect(page.locator('tbody tr')).toHaveCount(snapshot.candidates.length);
  expect(errors).toEqual([]);
});
