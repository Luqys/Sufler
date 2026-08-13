/// <reference lib="dom" />
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

function darkConfig(): string {
  const configHome = makeConfigHome();
  mkdirSync(join(configHome, 'sufler'), { recursive: true });
  writeFileSync(
    join(configHome, 'sufler', 'state.json'),
    JSON.stringify({ appearance: { mode: 'dark', accent: 'clay', language: 'pl' } }, null, 2),
  );
  return configHome;
}

test('ciemny motyw obejmuje edytor Monaco i terminal, nie tylko powłokę', async () => {
  const project = makeFixtureProject();
  const app = await launchApp(darkConfig(), project);
  const page = await app.firstWindow();
  await expect(page.getByTestId('workbench')).toBeVisible();

  // Monaco: ciemny motyw ma klasę vs-dark, nie jasną vs.
  await page.getByTestId('rail-files').click();
  await page.locator('.tree-name', { hasText: 'README.md' }).click();
  const editor = page.locator('.monaco-editor').first();
  await expect(editor).toBeVisible({ timeout: 20_000 });
  await expect(editor).toHaveClass(/vs-dark/);

  // xterm: tło terminala z ciemnej palety, nie białe.
  await page.getByTestId('bottom-new-terminal').click();
  await expect(page.locator('[data-testid=bottom-dock] .xterm')).toBeVisible({ timeout: 20_000 });
  await expect
    .poll(
      () =>
        page
          .locator('[data-testid=bottom-dock] .xterm-viewport')
          .evaluate((el) => getComputedStyle(el).backgroundColor),
      { timeout: 15_000 },
    )
    .toBe('rgb(27, 28, 33)');

  await page.screenshot({ path: 'e2e-artifacts/m60-motyw-edytor.png' });
  await app.close();
});

test('przełączenie na ciemny w locie przemalowuje edytor i terminal', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();

  await page.getByTestId('rail-files').click();
  await page.locator('.tree-name', { hasText: 'README.md' }).click();
  const editor = page.locator('.monaco-editor').first();
  await expect(editor).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('bottom-new-terminal').click();
  await expect(page.locator('[data-testid=bottom-dock] .xterm')).toBeVisible({ timeout: 20_000 });

  await page.getByTestId('settings-button').click();
  await page.getByTestId('theme-dark').click();

  // Karta Ustawień zajmuje obszar edytora — wracamy do pliku, żeby zobaczyć Monaco.
  await page.locator('.tab-title', { hasText: 'README.md' }).click();
  await expect(editor).toHaveClass(/vs-dark/, { timeout: 10_000 });
  await expect
    .poll(
      () =>
        page
          .locator('[data-testid=bottom-dock] .xterm-viewport')
          .evaluate((el) => getComputedStyle(el).backgroundColor),
      { timeout: 15_000 },
    )
    .toBe('rgb(27, 28, 33)');

  await app.close();
});
