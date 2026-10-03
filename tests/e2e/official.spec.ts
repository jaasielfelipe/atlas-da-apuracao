import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { normalizeEA20 } from '../../packages/tse/src/index';
import { compareZones } from '../../packages/domain/src/zones';
import { zoneFixture } from '../../packages/domain/src/zone-fixture';

test('oficial: matriz vazia e falha histórica preservam o agregado; layout responsivo', async ({
  page,
}) => {
  // Controlled synthetic responses, not evidence of official HTTP capture.
  const j = JSON.parse(readFileSync('packages/fixtures/simulado/ea20-president-br.json', 'utf8'));
  j.f = 'o';
  j.ele = '6257';
  const raw = JSON.stringify(j);
  const snapshot = normalizeEA20(j, {
    environment: 'official',
    electionId: '6257',
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
      'https://resultados.tse.jus.br/oficial/ele2026/6257/dados/br/br-c0001-e006257-u.json',
    capturedAt: '2026-10-03T22:00:00.000Z',
    raw,
  });
  const dataset = zoneFixture();
  dataset.environment = 'official';
  dataset.results = [];
  dataset.matches = [];
  const comparison = compareZones(dataset, snapshot.capturedAt);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/v1/official/archive', (r) =>
    r.fulfill({
      json: {
        environment: 'official',
        lastObservation: snapshot.capturedAt,
        coverage: { observedSegments: 0, expectedSegments: 4, completeZones: 0, expectedZones: 3 },
        territories: [{ id: 'br', kind: 'br', name: 'Brasil' }],
      },
    }),
  );
  await page.route('**/api/v1/official/results?*', (r) =>
    r.fulfill({ json: { snapshots: [snapshot] } }),
  );
  await page.route('**/api/v1/official/comparison?*', (r) =>
    r.fulfill({
      json: {
        comparison,
        timeline: [],
        method: 'Resposta sintética para teste visual; aceite informado pelo usuário.',
      },
    }),
  );
  await page.goto('/official');
  await expect(page.getByRole('heading', { name: 'Acervo oficial', exact: true })).toBeVisible();
  await expect(page.getByTestId('zone-cohort')).toHaveText(
    '0 comparáveis / 0 concluídas / 3 esperadas',
  );
  await expect(
    page.getByRole('region', { name: 'Resultado agregado oficial' }).locator('tbody tr'),
  ).toHaveCount(snapshot.candidates.length);
  await page.screenshot({ path: 'docs/evidence/official-archive-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.screenshot({ path: 'docs/evidence/official-archive-mobile.png', fullPage: true });
  await page.unroute('**/api/v1/official/comparison?*');
  await page.route('**/api/v1/official/comparison?*', (r) =>
    r.fulfill({ status: 503, json: { error: 'Histórico indisponível' } }),
  );
  await page.getByRole('button', { name: 'Atualizar acervo' }).click();
  await expect(page.getByRole('alert')).toContainText('Comparação indisponível');
  await expect(
    page.getByRole('region', { name: 'Resultado agregado oficial' }).locator('tbody tr'),
  ).toHaveCount(snapshot.candidates.length);
  expect(errors).toEqual([]);
});
