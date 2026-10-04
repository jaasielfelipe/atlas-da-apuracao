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
  await expect(page.locator('.board li')).not.toHaveCount(0);
  await expect(page.locator('.ufs .uf')).toHaveCount(27);
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
    if (Array.isArray(body)) return route.fulfill({ json: [...body, bump(body.at(-1))] });
    return route.fulfill({ json: { ...body, snapshot: bump(body.snapshot) } });
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
