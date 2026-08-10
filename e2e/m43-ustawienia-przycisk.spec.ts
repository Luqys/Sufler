import { expect, test } from '@playwright/test';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

test('zębatka na pasku tytułu otwiera kartę Ustawień z motywem Matrix', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();

  await page.getByTestId('settings-button').click();
  const view = page.getByTestId('settings-view');
  await expect(view).toBeVisible();
  await expect(view.getByTestId('theme-matrix')).toBeVisible();
  await page.screenshot({ path: 'e2e-artifacts/m43-ustawienia-przycisk.png' });

  await app.close();
});
