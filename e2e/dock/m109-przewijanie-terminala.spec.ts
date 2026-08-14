/// <reference lib="dom" />
import { expect, test, type Locator, type Page } from '@playwright/test';
import { launchApp, makeConfigHome, makeFixtureProject, wpiszPolecenie } from '../utils';

/** Kółko myszy nad środkiem terminala — grubą deltą, czyli ścieżką „myszy". */
async function zakrec(page: Page, terminal: Locator, deltaY: number): Promise<void> {
  const box = await terminal.boundingBox();
  if (!box) {
    throw new Error('terminal bez geometrii');
  }
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.wheel(0, deltaY);
}

test('kółko przewija scrollback zwykłego terminala', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();

  await page.getByTestId('bottom-new-terminal').click();
  const dock = page.locator('[data-testid=bottom-dock]');
  const terminal = dock.locator('.xterm');
  await expect(terminal).toBeVisible();
  // Znak zachęty, nie nazwa katalogu: runner CI wita bashem („bash-3.2$").
  await expect(terminal).toContainText(/[$%]/, { timeout: 15_000 });

  await wpiszPolecenie(page, terminal, 'for i in $(seq 1 200); do echo "wiersz $i"; done');
  await expect(terminal).toContainText('wiersz 200', { timeout: 15_000 });

  const ekran = dock.locator('.xterm-screen');
  await expect(ekran).toContainText('wiersz 200');

  // W górę: ogon bufora schodzi z ekranu, wracają wcześniejsze wiersze.
  await zakrec(page, terminal, -400);
  await zakrec(page, terminal, -400);
  await expect(ekran).not.toContainText('wiersz 200');

  // I z powrotem na dół — przewijanie działa w obie strony (dół się klamruje,
  // więc nadmiar obrotów tylko dociska widok do końca bufora).
  await zakrec(page, terminal, 400);
  await zakrec(page, terminal, 400);
  await zakrec(page, terminal, 400);
  await expect(ekran).toContainText('wiersz 200');

  await app.close();
});

test('w ekranie alternatywnym kółko trafia do programu, a nie w scrollback', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();

  await page.getByTestId('bottom-new-terminal').click();
  const dock = page.locator('[data-testid=bottom-dock]');
  const terminal = dock.locator('.xterm');
  await expect(terminal).toBeVisible();
  await expect(terminal).toContainText(/[$%]/, { timeout: 15_000 });

  // Atrapa TUI w duchu Claude Code: własna plansza (?1049h) i raportowanie
  // myszy w SGR (?1000h + ?1006h). `cat -v` pokazuje przychodzące bajty, więc
  // widać na ekranie, czy raport kółka w ogóle doszedł do programu.
  await wpiszPolecenie(
    page,
    terminal,
    "printf '\\033[?1049h\\033[?1000h\\033[?1006h'; echo GOTOWE; cat -v",
  );
  await expect(terminal).toContainText('GOTOWE', { timeout: 15_000 });

  // Gruba delta = ścieżka „myszy". Wcześniej zjadał ją nasz normalizator
  // (preventDefault + scrollLines po nieistniejącym scrollbacku) i program
  // nie dostawał nic — w karcie Claude nie dawało się cofnąć widoku.
  await zakrec(page, terminal, -300);
  // SGR: ESC [ < 64 ; kolumna ; wiersz M — 64 to kółko w górę.
  await expect(terminal).toContainText('[<64;', { timeout: 10_000 });

  await zakrec(page, terminal, 300);
  await expect(terminal).toContainText('[<65;', { timeout: 10_000 });

  await page.screenshot({ path: 'e2e-artifacts/m109-przewijanie-terminala.png' });

  // Sprzątanie: wyjście z ekranu alternatywnego, żeby zamknięcie nie wisiało.
  await page.keyboard.press('Control+c');
  await app.close();
});
