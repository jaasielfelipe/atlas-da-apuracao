import { test, expect } from '@playwright/test';

// Archives seeded by global-setup.ts (deterministic; the official BR/AC bodies are modified
// simulated captures, i.e. synthetic transport evidence, not official observations).

test('painel oficial ao vivo: dados do coletor, cobertura zonal, favoritos e layout', async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/live/official');
  await expect(page.locator('.badge')).toHaveText('OFICIAL TSE');
  await expect(page.getByText('Capturas do ambiente oficial do TSE.')).toBeVisible();
  await expect(page.getByText('Coletor parado', { exact: false }).first()).toBeVisible();
  await expect(page.getByTestId('atlas-map')).toHaveAttribute('data-ready', 'true');
  await expect(page.getByTestId('valid-votes')).not.toHaveText('—');
  await expect(page.locator('.advance-button')).toHaveCount(0); // fixture-only control
  await page.screenshot({ path: 'docs/evidence/live-official-desktop.png', fullPage: true });

  await page.getByRole('tab', { name: 'Cobertura' }).click();
  const collection = page.getByTestId('collection-status');
  await expect(collection).toContainText('1 / 6.292');
  await expect(collection).toContainText('0 / 2.641');

  // History database absent in this run: comparison reports unavailability, aggregates stay.
  await page.getByRole('tab', { name: 'Comparação' }).click();
  await expect(
    page.getByText('Históricos finais 2018/2022 · user_accepted_structural'),
  ).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('Comparação indisponível');

  // State drill-down uses the national municipal mesh.
  await page.getByRole('tab', { name: 'Resultado' }).click();
  await page.getByLabel('Unidade da federação').selectOption('sp');
  await expect(page.getByRole('img', { name: /Mapa dos municípios de São Paulo/i })).toBeVisible();
  await expect(page.getByTestId('atlas-map')).toHaveAttribute('data-ready', 'true');

  // Saving a municipality writes the collector's watchlist (the live collector picks it up).
  await page.getByLabel('Buscar município').fill('Rio Branco');
  await page.getByRole('button', { name: /RIO BRANCO\s*AC/ }).click();
  await expect(page.getByRole('heading', { name: 'Não monitorado', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Salvar município' }).click();
  await expect(page.getByText('◇ Monitoramento ativo')).toBeVisible();
  const enabled = (list: { territoryId: string; enabled: boolean }[]) =>
    list.filter((w) => w.enabled).map((w) => w.territoryId);
  const official = enabled(await (await request.get('/api/v1/live/official/watchlist')).json());
  expect(official).toHaveLength(1);
  // The fixture archive (shared with flow.spec in this run) never receives official actions.
  const fixture = enabled(await (await request.get('/api/v1/watchlist')).json());
  expect(fixture).not.toContain(official[0]);

  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.screenshot({ path: 'docs/evidence/live-official-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});

test('painel simulado ao vivo: selo próprio, sem comparação histórica; alias /simulated', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/simulated');
  await expect(page.locator('.badge')).toHaveText('SIMULADO TSE');
  await expect(page.getByText('Não são resultados oficiais.')).toBeVisible();
  await expect(page.getByTestId('valid-votes')).not.toHaveText('—');
  await page.getByRole('tab', { name: 'Comparação' }).click();
  await expect(page.getByText('Indisponível no simulado')).toBeVisible();
  await expect(page.locator('.chart-empty')).toBeVisible();
  await page.getByRole('tab', { name: 'Cobertura' }).click();
  await expect(page.getByTestId('collection-status')).toContainText('— / —');
  expect(errors).toEqual([]);
});
