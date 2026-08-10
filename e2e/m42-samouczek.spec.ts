import { expect, test } from '@playwright/test';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

test('samouczek: przycisk ? otwiera przewodnik z sekcjami i skrótami, Esc zamyka', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();

  await page.getByTestId('help-button').click();
  const dialog = page.getByTestId('help-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Samouczek Suflera');
  await expect(dialog).toContainText('Na start');
  await expect(dialog).toContainText('Wiedza i graf');
  await expect(dialog).toContainText('Skille i agenci');
  await expect(dialog).toContainText('Doki i terminale');
  await expect(dialog).toContainText('Skróty klawiszowe');
  await expect(dialog).toContainText('Cmd+P');
  await page.screenshot({ path: 'e2e-artifacts/m42-samouczek.png' });

  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();

  await app.close();
});
