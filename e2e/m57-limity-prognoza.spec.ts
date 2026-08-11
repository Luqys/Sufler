import { expect, test } from '@playwright/test';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

/** Odpowiedź endpointu limitów o zadanym zużyciu sesji. */
function limits(percent: number): string {
  return JSON.stringify({
    five_hour: { utilization: percent, resets_at: '2026-08-11T15:00:00+00:00' },
    seven_day: { utilization: 30, resets_at: '2026-08-16T09:00:00+00:00' },
  });
}

test('przekroczenie progu zużycia pokazuje ostrzeżenie', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject(), {
    VISUALN3O_LIMITS_JSON: limits(87),
  });
  const page = await app.firstWindow();

  const toast = page.getByTestId('toast');
  await expect(toast).toContainText('87%', { timeout: 15_000 });
  await expect(toast).toContainText('/clear');
  await page.screenshot({ path: 'e2e-artifacts/m57-ostrzezenie.png' });

  await app.close();
});

test('spokojne zużycie nie zawraca głowy ostrzeżeniem', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject(), {
    VISUALN3O_LIMITS_JSON: limits(42),
  });
  const page = await app.firstWindow();
  await expect(page.getByTestId('usage-limits-text')).toContainText('42%', { timeout: 15_000 });
  await expect(page.getByTestId('toast')).toHaveCount(0);
  await app.close();
});
