import { expect, test } from '@playwright/test';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

test('Cmd+, otwiera Ustawienia jako kartę w obszarze edytora', async () => {
  const project = makeFixtureProject();
  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();
  await expect(page.getByTestId('workbench')).toBeVisible();

  await page.keyboard.press('Meta+Comma');
  const view = page.getByTestId('settings-view');
  await expect(view).toBeVisible();
  await expect(view).toContainText('Projekt');
  await expect(view).toContainText(project);
  await expect(page.getByTestId('tab-active')).toContainText('Ustawienia');

  await page.screenshot({ path: 'e2e-artifacts/m9-ustawienia.png' });
  await app.close();
});
