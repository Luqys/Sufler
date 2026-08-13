/// <reference lib="dom" />
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

test('nazwa Sufler i motyw matrixowy: paleta UI, terminal, zapis stanu', async () => {
  const configHome = makeConfigHome();
  const app = await launchApp(configHome, makeFixtureProject());
  const page = await app.firstWindow();

  // Branding po zmianie nazwy.
  await expect(page.locator('.titlebar-title')).toContainText('Sufler');

  // Ustawienia → motyw Matrix nakłada data-flavor na <html>.
  await page.keyboard.press('Meta+,');
  await expect(page.getByTestId('settings-view')).toBeVisible();
  await page.getByTestId('theme-matrix').click();
  await expect(page.locator('html')).toHaveAttribute('data-flavor', 'matrix');
  await page.keyboard.press('Escape');

  // Terminal przechodzi na zieloną paletę (tło #050b06 z motywu).
  await page.getByTestId('bottom-new-terminal').click();
  await expect(page.locator('[data-testid=bottom-dock] .xterm')).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('[data-testid=bottom-dock] .xterm-viewport')
        .evaluate((el) => getComputedStyle(el).backgroundColor),
    )
    .toBe('rgb(5, 11, 6)');

  // Wybór trafia do state.json w nowym katalogu konfiguracji (sufler).
  await expect
    .poll(() => {
      try {
        const raw = JSON.parse(
          readFileSync(join(configHome, 'sufler', 'state.json'), 'utf8'),
        ) as { appearance?: { mode?: string } };
        return raw.appearance?.mode ?? null;
      } catch {
        return null;
      }
    })
    .toBe('matrix');

  await page.screenshot({ path: 'e2e-artifacts/m25-matrix.png' });

  // Szybki przełącznik motywu wychodzi z Matrixa (wariant ciemnego → jasny).
  await page.getByTestId('theme-quick-toggle').click();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset['flavor'] ?? null))
    .toBeNull();

  await app.close();
});
