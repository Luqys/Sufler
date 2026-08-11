import { expect, test } from '@playwright/test';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

test('panel boczny otwiera się w osobnym oknie', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();
  await expect(page.getByTestId('workbench')).toBeVisible();

  // Wyciągnięcie panelu (ta sama ścieżka, którą uruchamia upuszczenie poza oknem).
  await page.evaluate(() =>
    window.api.openDetachedWindow({ kind: 'panel', target: 'git', title: 'Historia git' }),
  );

  const detached = await app.waitForEvent('window', { timeout: 20_000 });
  await expect(detached.getByTestId('detached-panel')).toBeVisible({ timeout: 20_000 });
  await expect(detached.getByTestId('git-panel')).toBeVisible();
  // Okno główne działa dalej, niezależnie od oderwanego.
  await expect(page.getByTestId('workbench')).toBeVisible();
  await detached.screenshot({ path: 'e2e-artifacts/m62-panel-okno.png' });

  await app.close();
});

test('karta edytora otwiera się w osobnym oknie z treścią pliku', async () => {
  const project = makeFixtureProject();
  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();
  await expect(page.getByTestId('workbench')).toBeVisible();

  await page.evaluate((root) => {
    window.api.openDetachedWindow({
      kind: 'view',
      target: `${root}/README.md`,
      title: 'README.md',
    });
  }, project);

  const detached = await app.waitForEvent('window', { timeout: 20_000 });
  await expect(detached.getByTestId('detached-view')).toBeVisible({ timeout: 20_000 });
  await expect(detached.locator('.monaco-editor').first()).toBeVisible({ timeout: 25_000 });
  await expect(detached.getByTestId('tab-active')).toContainText('README.md');

  await app.close();
});
