import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
test('fluxo offline: mapa, captura, replay, favoritos, falhas e layout', async ({
  page,
  context,
  request,
}) => {
  const errors: string[] = [],
    external: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await context.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.protocol.startsWith('http') && url.hostname !== '127.0.0.1') {
      external.push(url.href);
      return route.abort();
    }
    return route.continue();
  });
  await page.goto('/');
  await expect(page.getByText('Números e horários sintéticos.', { exact: false })).toBeVisible();
  await expect(page.getByTestId('atlas-map')).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('.map-error')).toHaveCount(0);
  const votes = page.getByTestId('valid-votes');
  await expect(votes).not.toHaveText('0');
  const initial = await votes.textContent();
  await page.getByLabel('Métrica da timeline').selectOption('votes');
  await expect(page.getByRole('img', { name: 'Votos acumulados por captura' })).toBeVisible();
  await page.getByLabel('Escala da timeline').selectOption('progress');
  await expect(page.getByLabel('Instante da timeline')).toHaveValue('2');
  await page.getByLabel('Métrica da timeline').selectOption('share');
  await page.getByLabel('Escala da timeline').selectOption('time');
  mkdirSync('docs/evidence', { recursive: true });
  await page.screenshot({ path: 'docs/evidence/fixture-desktop.png', fullPage: true });
  await page.getByLabel('Instante da timeline').fill('0');
  await expect(votes).toHaveText('0');
  await expect(page.locator('.candidate-top strong').first()).toHaveText('—');
  await page.getByRole('tab', { name: 'Cobertura' }).click();
  await expect(page.locator('.metric').first()).toContainText('0,0%');
  await page.getByRole('tab', { name: 'Comparação' }).click();
  await expect(
    page.getByRole('heading', { name: 'Comparação territorial', exact: true }),
  ).toBeVisible();
  await expect(page.getByText('Zonas concluídas e conciliadas', { exact: true })).toBeVisible();
  await expect(page.getByText('Fixture ativa · coleta zonal nacional não validada')).toBeVisible();
  await expect(page.getByTestId('zone-cohort')).toContainText('0 comparáveis');
  await expect(page.getByLabel('Instante da timeline')).toHaveValue('0');
  await page.getByLabel('Instante da timeline').fill('2');
  await expect(page.getByTestId('zone-cohort')).toContainText('3 comparáveis');
  await expect(page.getByTestId('transition-matrix').locator('tbody tr')).toHaveCount(4);
  await page.getByLabel('Ano da matriz').selectOption('2022');
  await expect(page.getByTestId('transition-matrix').locator('caption')).toContainText('2022');
  await page.screenshot({ path: 'docs/evidence/fixture-comparison-zones.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/evidence/fixture-comparison-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.getByRole('tab', { name: 'Resultado' }).click();
  await page.getByRole('button', { name: 'Agora', exact: true }).click();
  await expect(votes).toHaveText(initial!);
  // Map navigation is real: click a polygon inside the Brazil map.
  const canvas = page.locator('.maplibregl-canvas');
  await canvas.click({ position: { x: 410, y: 190 } });
  await expect(page.getByLabel('Unidade da federação')).not.toHaveValue('');
  await page.getByLabel('Unidade da federação').selectOption('');
  await expect(votes).toHaveText(initial!);
  const beforeReplay = (await (await request.get('/api/v1/snapshots')).json()).length;
  await page.getByRole('button', { name: '▷ Replay', exact: true }).click();
  await expect(votes).toHaveText('0');
  await expect(page.getByLabel('Instante da timeline')).toHaveValue('2', { timeout: 8000 });
  await expect(page.getByRole('button', { name: '▷ Replay', exact: true })).toBeVisible({
    timeout: 4000,
  });
  expect((await (await request.get('/api/v1/snapshots')).json()).length).toBe(beforeReplay);
  await page.getByRole('button', { name: 'Agora', exact: true }).click();
  await page.getByRole('button', { name: '+ Próxima captura sintética', exact: true }).click();
  await expect(votes).not.toHaveText(initial!);
  await page.getByLabel('Cargo', { exact: true }).selectOption('governor');
  await expect(page.getByLabel('Unidade da federação')).toHaveValue('ac');
  await page.getByLabel('Buscar município').fill('Acrelandia');
  await page.getByRole('button', { name: 'ACRELÂNDIA AC · 01120' }).click();
  await expect(page.getByRole('heading', { name: 'Não monitorado', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Salvar município' }).click();
  await expect(votes).toBeVisible();
  await page.screenshot({ path: 'docs/evidence/fixture-municipality.png', fullPage: true });
  await page.reload();
  await page.locator('.saved-list button').click();
  await expect(page.getByText('◇ Monitoramento ativo')).toBeVisible();
  await page.getByLabel('Instante da timeline').fill('0');
  await expect(page.getByRole('heading', { name: 'Sem snapshot neste instante' })).toBeVisible();
  await page.getByRole('button', { name: 'Agora', exact: true }).click();
  await expect(votes).toBeVisible();
  await page.getByRole('button', { name: 'Parar', exact: true }).click();
  await expect(page.getByText('Monitoramento pausado')).toBeVisible();
  const previous = await votes.textContent();
  await page.getByRole('button', { name: '+ Próxima captura sintética', exact: true }).click();
  await expect(page.getByText('Sequência completa', { exact: true })).toBeVisible();
  await expect(votes).toHaveText(previous!);
  await page.locator('.provenance summary').click();
  await expect(page.getByText('Captura da fixture', { exact: true })).toBeVisible();
  const source = await page
    .getByRole('link', { name: 'Inspecionar JSON e hash ↗' })
    .getAttribute('href');
  expect((await (await request.get(source!)).json()).snapshot.environment).toBe('fixture');
  // A local API failure keeps the previous snapshot visible and reports its age/source.
  await page.route('**/api/v1/latest?*', (route) => route.abort());
  await page.getByLabel('Instante da timeline').fill('1');
  await expect(page.getByRole('alert')).toContainText('Último dado preservado');
  await expect(votes).toHaveText(previous!);
  await page.unroute('**/api/v1/latest?*');
  await page.getByRole('button', { name: 'Agora', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('tab', { name: 'Cobertura' }).click();
  await page.screenshot({ path: 'docs/evidence/fixture-coverage.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('tab', { name: 'Cobertura' })).toBeVisible();
  await page.screenshot({ path: 'docs/evidence/fixture-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
