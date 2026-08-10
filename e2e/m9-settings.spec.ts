import { expect, test } from '@playwright/test';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

test('Cmd+, otwiera ustawienia z menu aplikacji, Esc zamyka', async () => {
  const project = makeFixtureProject();
  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();
  await expect(page.getByTestId('workbench')).toBeVisible();

  await page.keyboard.press('Meta+Comma');
  const dialog = page.getByTestId('settings-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Projekt');
  await expect(dialog).toContainText(project);
  await expect(dialog).toContainText('Vault Obsidiana');

  await page.screenshot({ path: 'e2e-artifacts/m9-ustawienia.png' });

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);

  await app.close();
});
