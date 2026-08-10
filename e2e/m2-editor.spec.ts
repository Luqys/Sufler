import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

test('Cmd+S zapisuje na dysk, a zmiana z zewnątrz pokazuje pasek z akcjami', async () => {
  const project = makeFixtureProject();
  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();
  const tree = page.getByTestId('file-tree');
  const appTsPath = join(project, 'src', 'app.ts');

  await tree.getByText('src', { exact: true }).click();
  await tree.getByText('app.ts').click();
  await expect(page.getByTestId('tab-active')).toContainText('app.ts');

  // Edycja → kropka „brudnej" zakładki.
  await page.locator('.monaco-editor .view-lines').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' // dopisek testowy');
  await expect(page.getByTestId('tab-dirty')).toBeVisible();

  // Zapis → kropka znika, treść ląduje na dysku.
  await page.keyboard.press('Meta+s');
  await expect(page.getByTestId('tab-dirty')).toHaveCount(0);
  await expect.poll(() => readFileSync(appTsPath, 'utf8')).toContain('// dopisek testowy');

  // Modyfikacja z zewnątrz → pasek ostrzegawczy.
  writeFileSync(appTsPath, 'export const answer = 1000;\n');
  await expect(page.getByTestId('external-bar')).toBeVisible();
  await page.screenshot({ path: 'e2e-artifacts/m2-pasek-zewnetrzny.png' });

  // „Przeładuj" wciąga treść z dysku.
  await page.getByTestId('external-reload').click();
  await expect(page.getByTestId('external-bar')).toHaveCount(0);
  await expect(page.locator('.monaco-editor .view-lines')).toContainText('1000');

  // „Zachowaj moją wersję" — bufor wygrywa i nadpisuje dysk przy zapisie.
  writeFileSync(appTsPath, 'export const answer = 7;\n');
  await expect(page.getByTestId('external-bar')).toBeVisible();
  await page.getByTestId('external-keep').click();
  await expect(page.getByTestId('external-bar')).toHaveCount(0);
  await expect(page.getByTestId('tab-dirty')).toBeVisible();
  await page.keyboard.press('Meta+s');
  await expect.poll(() => readFileSync(appTsPath, 'utf8')).toContain('1000');

  await app.close();
});

test('plik graficzny otwiera się jako podgląd obrazka, nie edytor', async () => {
  const project = makeFixtureProject();
  // 1×1 px PNG — wystarcza do sprawdzenia wczytania i wymiarów.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  writeFileSync(join(project, 'logo.png'), png);
  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();

  await page.getByTestId('file-tree').getByText('logo.png').click();
  await expect(page.getByTestId('tab-active')).toContainText('logo.png');

  const viewer = page.getByTestId('image-viewer');
  await expect(viewer).toBeVisible();
  await expect(viewer.locator('img')).toBeVisible();
  await expect(viewer).toContainText('1 × 1 px');
  await expect(viewer).toContainText('B'); // rozmiar pliku w bajtach
  await expect(page.locator('.monaco-editor')).toHaveCount(0);

  await page.screenshot({ path: 'e2e-artifacts/m2-podglad-obrazka.png' });
  await app.close();
});

test('pojedyncze kliknięcie otwiera podgląd, podwójne przypina zakładkę', async () => {
  const project = makeFixtureProject();
  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();
  const tree = page.getByTestId('file-tree');
  const tabs = page.locator('.editor-tabs .tab');

  await tree.getByText('README.md').click();
  await expect(page.getByTestId('tab-active')).toContainText('README.md');
  await expect(tabs).toHaveCount(1);
  await expect(page.getByTestId('tab-active')).toHaveClass(/preview/);

  // Kolejny podgląd zastępuje poprzedni.
  await tree.getByText('.gitignore').click();
  await expect(tabs).toHaveCount(1);
  await expect(page.getByTestId('tab-active')).toContainText('.gitignore');

  // Podwójne kliknięcie przypina (podgląd został skonsumowany przez klik).
  await tree.getByText('src', { exact: true }).click();
  await tree.getByText('app.ts').dblclick();
  await expect(tabs).toHaveCount(1);
  await expect(page.getByTestId('tab-active')).toContainText('app.ts');
  await expect(page.getByTestId('tab-active')).not.toHaveClass(/preview/);

  // Nowy podgląd obok przypiętej.
  await tree.getByText('README.md').click();
  await expect(tabs).toHaveCount(2);
  await expect(page.getByTestId('tab-active')).toContainText('README.md');

  // Zamknięcie aktywnej wraca do sąsiada.
  await page.getByTestId('tab-active').locator('.tab-close').click();
  await expect(tabs).toHaveCount(1);
  await expect(page.getByTestId('tab-active')).toContainText('app.ts');

  await app.close();
});
