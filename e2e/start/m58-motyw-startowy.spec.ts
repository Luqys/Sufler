/// <reference lib="dom" />
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

function configWithTheme(mode: string): string {
  const configHome = makeConfigHome();
  mkdirSync(join(configHome, 'sufler'), { recursive: true });
  writeFileSync(
    join(configHome, 'sufler', 'state.json'),
    JSON.stringify({ appearance: { mode, accent: 'clay', language: 'pl' } }, null, 2),
  );
  return configHome;
}

test('zapisany ciemny motyw obowiązuje zaraz po starcie, nie dopiero po kliknięciu', async () => {
  const app = await launchApp(configWithTheme('dark'), makeFixtureProject());
  const page = await app.firstWindow();
  await expect(page.getByTestId('workbench')).toBeVisible();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  // Zmienne motywu są ciemne, a nie z domyślnej jasnej palety.
  const panel = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--panel').trim(),
  );
  expect(panel).toBe('#25262c');

  await page.screenshot({ path: 'e2e-artifacts/m58-motyw-startowy.png' });
  await app.close();
});

test('zapisany jasny motyw wygrywa z ciemnym ustawieniem systemu', async () => {
  const app = await launchApp(configWithTheme('light'), makeFixtureProject(), {
    // Wymuszamy ciemny motyw systemowy — jawny wybór ma go przebić.
    ELECTRON_FORCE_DARK: '1',
  });
  const page = await app.firstWindow();
  await expect(page.getByTestId('workbench')).toBeVisible();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  const panel = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--panel').trim(),
  );
  expect(panel).toBe('#ececef');

  await app.close();
});

test('przycisk motywu przełącza zapisany ciemny na jasny i z powrotem', async () => {
  // Regresja: przy zapisanym trybie dark/light nasłuch systemowy milczy,
  // więc przycisk musi sam ustawić data-theme — nie tylko zapisać wybór.
  const app = await launchApp(configWithTheme('dark'), makeFixtureProject());
  const page = await app.firstWindow();
  await expect(page.getByTestId('workbench')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.getByTestId('theme-quick-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.screenshot({ path: 'e2e-artifacts/m58-przelacznik-po-kliku.png' });

  await page.getByTestId('theme-quick-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await app.close();
});

test('motyw Matrix po restarcie zachowuje ciemną bazę i zieloną paletę', async () => {
  const app = await launchApp(configWithTheme('matrix'), makeFixtureProject());
  const page = await app.firstWindow();
  await expect(page.getByTestId('workbench')).toBeVisible();

  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).toHaveAttribute('data-flavor', 'matrix');

  await app.close();
});
