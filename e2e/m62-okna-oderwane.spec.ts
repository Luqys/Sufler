import { expect, test } from '@playwright/test';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

import type { DetachedTarget } from '../src/shared/detached';

/** window.api w evaluate — wąski wycinek WindowApi używany przez test. */
interface DetachedApiWindow {
  api: { openDetachedWindow(info: DetachedTarget): Promise<void> };
}

test('panel boczny otwiera się w osobnym oknie', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();
  await expect(page.getByTestId('workbench')).toBeVisible();

  // Wyciągnięcie panelu (ta sama ścieżka, którą uruchamia upuszczenie poza oknem).
  await page.evaluate(() =>
    (window as unknown as DetachedApiWindow).api.openDetachedWindow({
      kind: 'panel',
      target: 'git',
      title: 'Historia git',
    }),
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
    void (window as unknown as DetachedApiWindow).api.openDetachedWindow({
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
