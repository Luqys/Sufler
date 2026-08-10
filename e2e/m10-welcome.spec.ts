import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

test('ekran startowy: wybór z ostatnich folderów, terminal startuje w wybranym', async () => {
  const configHome = makeConfigHome();
  const project = makeFixtureProject();
  mkdirSync(join(configHome, 'visualn3o'), { recursive: true });
  writeFileSync(
    join(configHome, 'visualn3o', 'state.json'),
    JSON.stringify({ recentRoots: [project] }),
  );

  // Bez VISUALN3O_ROOT → aplikacja pyta o folder.
  const app = await launchApp(configHome);
  const page = await app.firstWindow();

  await expect(page.getByTestId('welcome')).toBeVisible();
  await expect(page.getByTestId('welcome-open')).toBeVisible();
  const recent = page.getByTestId('welcome-recent').first();
  await expect(recent).toContainText(project.split('/').filter(Boolean).pop() ?? '');
  await page.screenshot({ path: 'e2e-artifacts/m10-ekran-startowy.png' });

  await recent.click();
  await expect(page.getByTestId('workbench')).toBeVisible();
  await expect(page.getByTestId('file-tree').getByText('README.md')).toBeVisible();

  // Terminal otwiera się w wybranym folderze.
  await page.getByTestId('bottom-dock-add').click();
  await page.getByTestId('bottom-menu-new-terminal').click();
  const terminal = page.locator('[data-testid=bottom-dock] .xterm');
  await expect(terminal).toBeVisible();
  await page.keyboard.type('echo KATALOG-$PWD');
  await page.keyboard.press('Enter');
  await expect(terminal).toContainText('KATALOG-/', { timeout: 15_000 });
  await expect(terminal).toContainText('vn3o-proj-', { timeout: 15_000 });

  await app.close();
});

test('drzewo pokazuje kolorowe ikony wg typu pliku', async () => {
  const project = makeFixtureProject();
  writeFileSync(join(project, 'style.css'), 'body {}\n');
  writeFileSync(join(project, 'obrazek.png'), 'nie-prawdziwy-png');
  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();
  const tree = page.getByTestId('file-tree');

  await expect(tree.locator('.tree-row', { hasText: 'README.md' }).locator('svg[data-icon=md]')).toBeVisible();
  await expect(tree.locator('.tree-row', { hasText: '.gitignore' }).locator('svg[data-icon=git]')).toBeVisible();
  await expect(tree.locator('.tree-row', { hasText: 'style.css' }).locator('svg[data-icon=css]')).toBeVisible();
  await expect(tree.locator('.tree-row', { hasText: 'obrazek.png' }).locator('svg[data-icon=image]')).toBeVisible();
  await expect(tree.locator('.tree-row', { hasText: 'src' }).first().locator('svg[data-icon=folder]')).toBeVisible();

  await tree.getByText('src', { exact: true }).click();
  await expect(tree.locator('.tree-row', { hasText: 'app.ts' }).locator('svg[data-icon=ts]')).toBeVisible();

  await page.screenshot({ path: 'e2e-artifacts/m10-ikony-plikow.png' });
  await app.close();
});
