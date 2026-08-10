import { expect, test } from '@playwright/test';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

test('drzewo koloruje status git i odświeża go na zdarzeniach chokidar', async () => {
  const project = makeFixtureProject();
  appendFileSync(join(project, 'src', 'app.ts'), '// lokalna zmiana\n');
  writeFileSync(join(project, 'nowy-plik.txt'), 'świeży\n');

  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();
  const tree = page.getByTestId('file-tree');

  // Katalog z modyfikacją w środku i plik nieśledzony mają klasy statusu.
  await expect(tree.locator('.tree-row', { hasText: 'src' }).first()).toHaveClass(/git-modified/);
  await expect(tree.locator('.tree-row', { hasText: 'nowy-plik.txt' })).toHaveClass(
    /git-untracked/,
  );

  await tree.getByText('src', { exact: true }).click();
  await expect(tree.locator('.tree-row', { hasText: 'app.ts' })).toHaveClass(/git-modified/);

  // Zmiana z zewnątrz → kolor pojawia się bez ręcznego odświeżania.
  await expect(tree.locator('.tree-row', { hasText: 'README.md' })).not.toHaveClass(
    /git-modified/,
  );
  appendFileSync(join(project, 'README.md'), 'dopisek\n');
  await expect(tree.locator('.tree-row', { hasText: 'README.md' })).toHaveClass(/git-modified/, {
    timeout: 10_000,
  });

  await page.screenshot({ path: 'e2e-artifacts/m7-status-git.png' });
  await app.close();
});

test('wyszukiwanie ripgrep znajduje znany ciąg i otwiera plik', async () => {
  const project = makeFixtureProject();
  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();

  await page.getByTestId('rail-search').click();
  await page.getByTestId('search-input').fill('answer');

  const firstMatch = page.getByTestId('search-match').first();
  await expect(firstMatch).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('search-panel')).toContainText('src/app.ts');

  await firstMatch.click();
  await expect(page.getByTestId('tab-active')).toContainText('app.ts');
  await expect(page.locator('.monaco-editor .view-lines')).toContainText('answer');

  await page.screenshot({ path: 'e2e-artifacts/m7-wyszukiwanie.png' });
  await app.close();
});

test('skróty przełączają panele, a stan widoczności przeżywa restart', async () => {
  const configHome = makeConfigHome();
  const project = makeFixtureProject();
  const layoutFile = join(configHome, 'visualn3o', 'layout.json');

  let app = await launchApp(configHome, project);
  let page = await app.firstWindow();
  await expect(page.getByTestId('sidebar')).toBeVisible();

  await page.keyboard.press('Meta+b');
  await expect(page.getByTestId('sidebar')).toHaveCount(0);
  await page.keyboard.press('Control+`');
  await expect(page.getByTestId('bottom-dock')).toHaveCount(0);
  await page.keyboard.press('Meta+Shift+c');
  await expect(page.getByTestId('right-dock')).toHaveCount(0);

  await expect
    .poll(() => {
      const layout = readJson(layoutFile) as Record<string, unknown> | null;
      return layout
        ? [layout['sidebarVisible'], layout['bottomDockVisible'], layout['rightDockVisible']]
        : null;
    })
    .toEqual([false, false, false]);

  await app.close();

  app = await launchApp(configHome, project);
  page = await app.firstWindow();
  await expect(page.getByTestId('workbench')).toBeVisible();
  await expect(page.getByTestId('sidebar')).toHaveCount(0);
  await expect(page.getByTestId('bottom-dock')).toHaveCount(0);
  await expect(page.getByTestId('right-dock')).toHaveCount(0);

  await page.keyboard.press('Meta+b');
  await expect(page.getByTestId('sidebar')).toBeVisible();

  await app.close();
});
