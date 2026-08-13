import { expect, test } from '@playwright/test';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

test('podział przestrzeni roboczej: grupy edytora i panele doku bez limitu', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();

  // Plik w edytorze — podział sklonuje go do nowej grupy.
  const tree = page.getByTestId('file-tree');
  await tree.getByText('README.md').click();
  await expect(page.getByTestId('tab-active')).toContainText('README.md');

  // Podział edytora: nowa grupa obok z klonem aktywnej zakładki.
  await page.getByTestId('editor-group-0').getByTestId('editor-split').click();
  await expect(page.getByTestId('editor-group-1')).toBeVisible();
  await expect(page.locator('[data-testid=editor-tabs]')).toHaveCount(2);
  await expect(page.getByTestId('editor-group-1').getByTestId('tab-active')).toContainText(
    'README.md',
  );

  // …i jeszcze raz — podział jest rekurencyjny, każdą grupę wolno dzielić dalej.
  await page.getByTestId('editor-group-1').getByTestId('editor-split').click();
  await expect(page.locator('[data-testid=editor-tabs]')).toHaveCount(3);

  // Zamknięcie klona zwija grupę — wracamy do dwóch kolumn.
  await page.getByTestId('editor-group-2').locator('.tab-close').click();
  await expect(page.locator('[data-testid=editor-tabs]')).toHaveCount(2);

  // Prawy dok: pojedynczy terminal, a podział mimo to działa — świeża sesja obok.
  await page.getByTestId('right-new-terminal').click();
  await expect(page.locator('[data-testid=right-dock] .xterm')).toBeVisible();
  await page.getByTestId('right-pane-split').click();
  await expect(page.getByTestId('right-pane-1')).toBeVisible();
  await expect(page.locator('[data-testid=right-dock] .xterm')).toHaveCount(2, {
    timeout: 15_000,
  });

  // …i dalej: kolejny podział — trzeci panel, wciąż bez limitu.
  await page.getByTestId('right-pane-split').click();
  await expect(page.getByTestId('right-pane-2')).toBeVisible();
  await expect(page.locator('[data-testid=right-dock] .xterm')).toHaveCount(3, {
    timeout: 15_000,
  });

  await page.screenshot({ path: 'e2e-artifacts/m31-podzialy.png' });
  await app.close();
});
