import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

test('drzewo respektuje .gitignore, a przełącznik pokazuje ignorowane wpisy', async () => {
  const project = makeFixtureProject();
  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();
  const tree = page.getByTestId('file-tree');

  await expect(tree).toBeVisible();
  await expect(tree.getByText('README.md')).toBeVisible();
  await expect(tree.getByText('src', { exact: true })).toBeVisible();
  await expect(tree.getByText('.gitignore')).toBeVisible();
  await expect(tree.getByText('node_modules')).toHaveCount(0);
  await expect(tree.getByText('debug.log')).toHaveCount(0);

  await page.getByTestId('toggle-ignored').click();
  await expect(tree.getByText('node_modules')).toBeVisible();
  await expect(tree.getByText('debug.log')).toBeVisible();

  await page.getByTestId('toggle-ignored').click();
  await expect(tree.getByText('node_modules')).toHaveCount(0);

  await app.close();
});

test('kliknięcie pliku w drzewie otwiera go w Monaco', async () => {
  const project = makeFixtureProject();
  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleErrors.push(message.text());
    }
  });
  const tree = page.getByTestId('file-tree');

  await tree.getByText('src', { exact: true }).click();
  await tree.getByText('app.ts').click();

  await expect(page.getByTestId('tab-active')).toContainText('app.ts');
  await expect(page.getByTestId('tab-active')).toHaveAttribute(
    'title',
    join(project, 'src', 'app.ts'),
  );
  await expect(page.locator('.monaco-editor .view-lines')).toContainText('answer');

  // Monaco pod file:// potrafi po cichu stracić web workery — ma to być głośna porażka.
  const workerFailures = consoleErrors.filter((text) => /worker/i.test(text));
  expect(workerFailures).toEqual([]);

  await page.screenshot({ path: 'e2e-artifacts/m1-monaco-otwarty.png' });
  await app.close();
});

test('przycisk odświeżania pokazuje pliki dodane z zewnątrz', async () => {
  const project = makeFixtureProject();
  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();
  const tree = page.getByTestId('file-tree');

  await expect(tree.getByText('README.md')).toBeVisible();
  writeFileSync(join(project, 'nowy-plik.ts'), 'export {};\n');
  await page.getByTestId('refresh-tree').click();
  await expect(tree.getByText('nowy-plik.ts')).toBeVisible();

  await app.close();
});
