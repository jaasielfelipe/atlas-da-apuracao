import { test, expect } from '@playwright/test';

// Fixture archive (synthetic, labelled): exercises the big-screen view end to end, including a
// new bulletin arriving while the page is open.
test('telão: pista, placar, mesmas zonas, faixa de UFs e novo boletim ao vivo', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/telao');
  await expect(page.locator('.t-badge')).toHaveText('FIXTURE');
  await expect(page.getByText('Números e horários sintéticos.', { exact: false })).toBeVisible();
  await expect(page.getByRole('img', { name: /Pista da apuração/ })).toBeVisible();
  await expect(page.locator('.race-runner')).toHaveCount(2);
  await expect(page.locator('.others-line')).toContainText('Demais');
  await expect(page.locator('.region-name').first()).toContainText('Sul');
  await expect(page.locator('.feed')).toBeVisible();
  await expect(page.locator('.stats').first()).toContainText('Votos apurados');
  await expect(page.locator('.outcome')).toHaveCount(3);
  await expect(page.locator('.mosaic .col')).not.toHaveCount(0);
  await expect(page.locator('.mosaic .col.focus')).toHaveCount(1);
  await expect(page.locator('.readout .uf-name')).not.toBeEmpty();
  // Rotating focus moves to another state.
  const firstFocus = await page.locator('.readout .uf-name').textContent();
  await expect(page.locator('.readout .uf-name')).not.toHaveText(firstFocus!, { timeout: 12_000 });
  // Same-zones card never pairs real names with synthetic numbers.
  await expect(page.locator('.same-zones')).toContainText('Série L');
  await expect(page.locator('.same-zones')).not.toContainText('Lula');
  await expect(page.locator('.same-zones')).toContainText('Não é estimativa do resultado nacional');
  const counted = await page.locator('.t-counted .big').getAttribute('aria-label');

  // Next bulletin, simulated in the browser only (the shared fixture database is not advanced):
  // the latest snapshot gains votes and sections under a new digest.
  const next = async (route: import('@playwright/test').Route) => {
    const response = await route.fetch();
    const body = await response.json();
    const bump = (s: any) => ({
      ...s,
      digest: `${s.digest}-next`,
      id: `${s.id}-next`,
      capturedAt: new Date().toISOString(),
      sections: {
        ...s.sections,
        totalized: s.sections.totalized + 1,
        share: Math.min(1, (s.sections.share ?? 0) + 0.05),
      },
      candidates: s.candidates.map((c: any) => ({
        ...c,
        countedVotes: c.countedVotes === null ? null : c.countedVotes + 250_000,
      })),
    });
    // Only the national bulletin advances; other territories (e.g. exterior) pass through.
    if (!route.request().url().includes('territory=br'))
      return route.fulfill({ response, json: body });
    if (Array.isArray(body)) return route.fulfill({ json: [...body, bump(body.at(-1))] });
    return route.fulfill({ json: { ...body, snapshot: body.snapshot && bump(body.snapshot) } });
  };
  await page.route('**/api/v1/latest?*', next);
  await page.route('**/api/v1/snapshots?*', next);
  await expect(page.locator('.t-live')).toHaveClass(/fresh/, { timeout: 12_000 });
  await expect(page.locator('.t-live')).toContainText('Novo boletim');
  await expect(page.locator('.race-runner .inc').first()).toBeVisible();
  await expect(page.locator('.t-counted .big')).not.toHaveAttribute('aria-label', counted!);
  await page.screenshot({ path: 'docs/evidence/telao-fixture.png' });
  // The stage scales to any window without scrolling.
  await page.setViewportSize({ width: 1280, height: 720 });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <= window.innerWidth &&
        document.documentElement.scrollHeight <= window.innerHeight,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test('telão demonstração: boletins sintéticos em sequência e fatos aritméticos', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/telao?demo=vitoria&ritmo=800');
  await expect(page.locator('.t-badge')).toHaveText('DEMONSTRAÇÃO');
  await expect(page.getByText('Não são resultados.', { exact: false })).toBeVisible();
  // Never real names on synthetic numbers.
  await expect(page.locator('.race-runner .name').first()).toContainText('Candidatura');
  const first = await page.locator('.t-counted .big').getAttribute('aria-label');
  await expect(page.locator('.t-counted .big')).not.toHaveAttribute('aria-label', first!, {
    timeout: 5_000,
  });
  await expect(page.locator('.outcome.on')).toContainText('Vitória matemática', {
    timeout: 45_000,
  });
  // Results coming in: synthetic município–zona updates with votes added in this election.
  await expect(page.locator('.feed li').first()).toContainText('seções');
  // The other outcomes stay on screen, faded.
  await expect(page.locator('.outcome:not(.on)')).toHaveCount(2);
  await expect(
    page.locator('.race-runner').filter({ hasText: 'passou da meta ajustada' }),
  ).toHaveCount(1);
  expect(errors).toEqual([]);
});
