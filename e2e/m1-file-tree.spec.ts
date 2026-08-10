import { expect, test } from '@playwright/test';
import { execSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _electron as electron, type ElectronApplication } from 'playwright';

function makeFixtureProject(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vn3o-proj-'));
  writeFileSync(join(dir, '.gitignore'), 'node_modules/\n*.log\n');
  writeFileSync(join(dir, 'README.md'), '# Projekt testowy\n');
  writeFileSync(join(dir, 'debug.log'), 'ukryty\n');
  mkdirSync(join(dir, 'src'));
  writeFileSync(join(dir, 'src', 'app.ts'), "export const answer = 42;\nconsole.log('witaj', answer);\n");
  mkdirSync(join(dir, 'node_modules', 'fake-pkg'), { recursive: true });
  writeFileSync(join(dir, 'node_modules', 'fake-pkg', 'index.js'), 'module.exports = 1;\n');
  execSync('git init', { cwd: dir, stdio: 'ignore' });
  return dir;
}

function launchApp(configHome: string, projectRoot: string): Promise<ElectronApplication> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined) {
      env[key] = value;
    }
  }
  env['XDG_CONFIG_HOME'] = configHome;
  env['VISUALN3O_ROOT'] = projectRoot;
  delete env['ELECTRON_RENDERER_URL'];
  return electron.launch({ args: ['.'], env });
}

test('drzewo respektuje .gitignore, a przełącznik pokazuje ignorowane wpisy', async () => {
  const configHome = mkdtempSync(join(tmpdir(), 'vn3o-e2e-'));
  const project = makeFixtureProject();
  const app = await launchApp(configHome, project);
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
  const configHome = mkdtempSync(join(tmpdir(), 'vn3o-e2e-'));
  const project = makeFixtureProject();
  const app = await launchApp(configHome, project);
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

  await expect(page.getByTestId('current-file')).toHaveText('src/app.ts');
  await expect(page.locator('.monaco-editor .view-lines')).toContainText('answer');

  // Monaco pod file:// potrafi po cichu stracić web workery — ma to być głośna porażka.
  const workerFailures = consoleErrors.filter((text) => /worker/i.test(text));
  expect(workerFailures).toEqual([]);

  await page.screenshot({ path: 'e2e-artifacts/m1-monaco-otwarty.png' });
  await app.close();
});

test('przycisk odświeżania pokazuje pliki dodane z zewnątrz', async () => {
  const configHome = mkdtempSync(join(tmpdir(), 'vn3o-e2e-'));
  const project = makeFixtureProject();
  const app = await launchApp(configHome, project);
  const page = await app.firstWindow();
  const tree = page.getByTestId('file-tree');

  await expect(tree.getByText('README.md')).toBeVisible();
  writeFileSync(join(project, 'nowy-plik.ts'), 'export {};\n');
  await page.getByTestId('refresh-tree').click();
  await expect(tree.getByText('nowy-plik.ts')).toBeVisible();

  await app.close();
});
