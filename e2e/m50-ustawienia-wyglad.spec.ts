import { expect, test } from '@playwright/test';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

test('Ustawienia: segmentowane przełączniki, pełny opis i zrzuty w trzech motywach', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();

  await page.getByTestId('settings-button').click();
  const view = page.getByTestId('settings-view');
  await expect(view).toBeVisible();

  // Podtytuł i opisy sekcji zamiast gołych nagłówków.
  await expect(view).toContainText('zmiany zapisują się od razu');
  await expect(view).toContainText('Wymaga pluginu Local REST API');

  // Podpowiedź o Cmd+Shift+L jest w całości widoczna (nie ucięta wielokropkiem).
  const hint = view.locator('.settings-hint').last();
  await expect(hint).toContainText('pod wskazany nagłówek');
  const clipped = await hint.evaluate(
    (element) => element.scrollWidth > element.clientWidth + 1,
  );
  expect(clipped).toBe(false);

  // Motyw i język to segmentowane przełączniki z zaznaczonym stanem.
  await expect(view.getByTestId('theme-system')).toHaveClass(/segmented-btn/);
  await expect(view.getByTestId('language-pl')).toHaveClass(/active/);

  await page.screenshot({ path: 'e2e-artifacts/m50-ustawienia-jasny.png' });
  await view.getByTestId('theme-dark').click();
  await expect(view.getByTestId('theme-dark')).toHaveClass(/active/);
  await page.screenshot({ path: 'e2e-artifacts/m50-ustawienia-ciemny.png' });
  await view.getByTestId('theme-matrix').click();
  await page.screenshot({ path: 'e2e-artifacts/m50-ustawienia-matrix.png' });

  await app.close();
});

test('nakładka grafu: tryby w równych rzędach, stan aktywny przycisku', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();

  await page.getByTestId('rail-knowledge').click();
  await expect(page.getByTestId('graph-stats')).toContainText('notatk', { timeout: 15_000 });

  // Pięć trybów układa się w dwa rzędy — żaden nie wystaje poza kartę legendy.
  const legend = page.getByTestId('graph-legend');
  const overflow = await legend.evaluate((element) => element.scrollWidth > element.clientWidth + 1);
  expect(overflow).toBe(false);

  const orphans = page.getByTestId('graph-orphans');
  await orphans.click();
  await expect(orphans).toHaveClass(/graph-orphans-on/);
  await page.screenshot({ path: 'e2e-artifacts/m50-graf-nakladka.png' });

  await app.close();
});
