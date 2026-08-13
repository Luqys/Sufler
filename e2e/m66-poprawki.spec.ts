import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  launchApp,
  makeConfigHome,
  makeFixtureProject,
  makeRawKeysClaudeBin,
} from './utils';

/**
 * M66 — poprawki ze zgłoszeń użytkowników: Shift+Enter jako nowa linia
 * w karcie Claude, przycisk kopiowania polecenia, druga przeglądarka
 * i jednolite tempo przewijania.
 */

test('Shift+Enter łamie polecenie na nową linię, a przycisk kopiuje zaznaczenie', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject(), {
    VISUALN3O_PATH_PREPEND: makeRawKeysClaudeBin(),
  });
  const page = await app.firstWindow();

  await page.getByTestId('right-new-claude').click();
  const terminal = page.locator('[data-testid=right-dock] .xterm');
  await expect(terminal).toContainText('atrapa klawiszy', { timeout: 15_000 });

  // Atrapa pokazuje surowe bajty (`cat -v`): ESC jako ^[, CR jako ^M.
  await terminal.click();
  await page.keyboard.type('abc');
  await page.keyboard.press('Shift+Enter');
  await expect(terminal).toContainText('abc^[^M', { timeout: 15_000 });

  // Zwykły Enter zostaje samym CR — polecenie leci do Claude.
  await page.keyboard.type('def');
  await page.keyboard.press('Enter');
  await expect(terminal).toContainText('def^M', { timeout: 15_000 });
  await expect(terminal).not.toContainText('def^[');

  // Zaznaczenie myszą w terminalu → przycisk „Kopiuj polecenie" bierze je do schowka.
  const box = await terminal.boundingBox();
  if (!box) {
    throw new Error('terminal bez geometrii');
  }
  await page.mouse.move(box.x + 8, box.y + 6);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 12, box.y + 24, { steps: 8 });
  await page.mouse.up();

  await page.getByTestId('right-copy-prompt').click();
  await expect
    .poll(() => app.evaluate(({ clipboard }) => clipboard.readText()), { timeout: 10_000 })
    .toContain('Claude Code');

  await page.screenshot({ path: 'e2e-artifacts/m66-shift-enter-kopiowanie.png' });
  await app.close();
});

test('drugie kliknięcie globusa otwiera osobną przeglądarkę z własnym adresem', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();

  await page.getByTestId('open-preview').click();
  await expect(page.getByTestId('tab-active')).toContainText('Podgląd');
  await page.getByTestId('preview-address').fill('127.0.0.1:4321');
  await page.getByTestId('preview-go').click();

  // Zgłoszenie użytkowników: przedtem drugie kliknięcie tylko wracało do tej
  // samej karty, bo wszystkie podglądy miały jedną pseudo-ścieżkę.
  await page.getByTestId('open-preview').click();
  await expect(page.getByTestId('tab-active')).toContainText('Podgląd 2');
  await expect(page.getByTestId('editor-tabs').getByTestId(/^tab(-active)?$/)).toHaveCount(2);
  // Świeży podgląd ma domyślny adres, nie ten z karty obok.
  await expect(page.getByTestId('preview-address')).toHaveValue('http://localhost:3000');

  // Powrót do pierwszej karty — jej adres przeżył przełączenie.
  await page.getByTestId('editor-tabs').getByTestId('tab').first().click();
  await expect(page.getByTestId('preview-address')).toHaveValue('http://127.0.0.1:4321');

  await page.screenshot({ path: 'e2e-artifacts/m66-dwie-przegladarki.png' });
  await app.close();
});

test('kółko myszy przewija stałym krokiem — każde kliknięcie tyle samo', async () => {
  const project = makeFixtureProject();
  for (let index = 1; index <= 30; index += 1) {
    const name = `skill-${String(index).padStart(2, '0')}`;
    const dir = join(project, '.claude', 'skills', name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'SKILL.md'),
      `---\nname: ${name}\ndescription: Opis testowy ${index}\n---\n`,
    );
  }

  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();

  await page.getByTestId('rail-skills').click();
  const panel = page.getByTestId('skills-panel');
  await expect(panel.getByText('skill-01')).toBeVisible();

  const view = page.locator('.view-panel.scroll:not(.hidden)');
  await view.hover();
  const scrollTop = (): Promise<number> => view.evaluate((element) => element.scrollTop);

  // Jedno „kliknięcie" kółka (delta 100 px) daje krok w wierszach, nie surowe 100 px.
  await page.mouse.wheel(0, 100);
  await expect.poll(scrollTop).toBeGreaterThan(0);
  const first = await scrollTop();
  expect(first).toBeLessThan(100);

  // Spokojne kręcenie (poza okienkiem przyspieszenia) — drugi krok równy pierwszemu.
  await page.waitForTimeout(400);
  await page.mouse.wheel(0, 100);
  await expect.poll(scrollTop).toBeGreaterThan(first);
  const second = await scrollTop();
  expect(second - first).toBe(first);

  await page.screenshot({ path: 'e2e-artifacts/m66-przewijanie.png' });
  await app.close();
});
