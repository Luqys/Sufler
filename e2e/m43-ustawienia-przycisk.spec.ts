import { expect, test } from '@playwright/test';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

test('zębatka na pasku tytułu otwiera Ustawienia z wyborem motywu Matrix', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();

  await page.getByTestId('settings-button').click();
  const dialog = page.getByTestId('settings-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByTestId('theme-matrix')).toBeVisible();
  await page.screenshot({ path: 'e2e-artifacts/m43-ustawienia-przycisk.png' });

  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();

  await app.close();
});
