import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

/** Katalog powyżej limitu wyświetlania (2000 wpisów wg pomiaru z M88). */
function makeBigDir(project: string, count: number): void {
  const dir = join(project, 'dane');
  mkdirSync(dir, { recursive: true });
  for (let index = 0; index < count; index += 1) {
    writeFileSync(join(dir, `rekord${String(index).padStart(5, '0')}.json`), '{}');
  }
}

test('M88: katalog powyżej limitu otwiera się płynnie i mówi, ile wpisów ukryto', async () => {
  const project = makeFixtureProject();
  makeBigDir(project, 2400);

  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();
  await expect(page.getByTestId('file-tree')).toBeVisible();

  const start = Date.now();
  await page.getByRole('button', { name: /dane/ }).first().click();
  // Notka o przycięciu pojawia się razem z zawartością katalogu.
  const capped = page.getByTestId('tree-capped');
  await expect(capped).toBeVisible({ timeout: 15_000 });
  const elapsed = Date.now() - start;

  await expect(capped).toContainText('400');
  // Budżet z zapasem: pomiar dawał ~90 ms na `check-ignore` dla 2000 ścieżek.
  expect(elapsed).toBeLessThan(5000);

  await page.screenshot({ path: 'e2e-artifacts/m88-duze-repo.png' });
  await app.close();
});

test('M88: mały katalog nie pokazuje notki o przycięciu', async () => {
  const project = makeFixtureProject();
  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();

  await expect(page.getByTestId('file-tree')).toBeVisible();
  await page.getByRole('button', { name: /src/ }).first().click();
  await expect(page.getByTestId('tree-capped')).toHaveCount(0);

  await app.close();
});
