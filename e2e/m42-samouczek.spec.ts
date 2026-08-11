import { expect, test } from '@playwright/test';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

test('samouczek: przycisk ? otwiera kartę przewodnika z sekcjami i skrótami', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();

  await page.getByTestId('help-button').click();
  const dialog = page.getByTestId('help-view');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Samouczek Suflera');
  await expect(dialog).toContainText('Na start');
  await expect(dialog).toContainText('Wiedza i graf');
  await expect(dialog).toContainText('Skille i agenci');
  await expect(dialog).toContainText('Doki i terminale');
  await expect(dialog).toContainText('Dziennik sesji — oszczędzanie kontekstu');
  await expect(dialog).toContainText('Punkty przywracania');
  await expect(dialog).toContainText('Historia pracy');
  await expect(dialog).toContainText('Limity planu');
  await expect(dialog).toContainText('Skróty klawiszowe');
  await expect(dialog).toContainText('Cmd+P');
  await expect(page.getByTestId('tab-active')).toContainText('Samouczek');
  await page.screenshot({ path: 'e2e-artifacts/m42-samouczek.png' });

  await app.close();
});
