import { expect, test } from '@playwright/test';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

test('HTTP 429 w limitach: przyjazny komunikat zamiast surowego błędu', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject(), {
    VISUALN3O_LIMITS_JSON: 'status:429',
  });
  const page = await app.firstWindow();

  await page.getByTestId('usage-button').click();
  const panel = page.getByTestId('usage-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Za dużo zapytań o limity');
  await expect(panel).toContainText('spróbuję ponownie');
  await expect(panel).not.toContainText('Endpoint limitów odpowiedział');

  await page.screenshot({ path: 'e2e-artifacts/m41-limity-429.png' });
  await app.close();
});
