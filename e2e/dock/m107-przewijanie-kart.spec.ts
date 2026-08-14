/// <reference lib="dom" />
import { expect, test, type Locator, type Page } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

/**
 * M107 — strzałki przewijania paska zakładek. Scenariusze pracują na PRAWYM
 * doku, bo ma stałe 360 px szerokości (domyślny układ): pasek zapycha się tam
 * kilkoma kartami niezależnie od rozmiaru ekranu, na którym leci suita.
 */

/** Atrapa `claude`: dochodzi do znaku zachęty, czyli karta świeci „skończone". */
function makeClaudeBin(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vn3o-m107-'));
  const script = `#!/bin/zsh
echo "── Claude Code (atrapa M107) ──"
echo "? for shortcuts"
cat > /dev/null
`;
  writeFileSync(join(dir, 'claude'), script, { mode: 0o755 });
  return dir;
}

/**
 * Dokłada terminale do prawego doku, aż spełni się warunek scenariusza.
 * Liczba kart potrzebnych do zapchania paska zależy od tytułów i fontu,
 * więc test nie zgaduje jej z góry — dokłada do skutku (najwyżej dziewięć).
 */
async function dokladajKarty(
  page: Page,
  karty: Locator,
  od: number,
  gotowe: () => Promise<boolean>,
): Promise<void> {
  for (let i = od; i < 9; i += 1) {
    if (await gotowe()) {
      return;
    }
    await page.getByTestId('right-new-terminal').click();
    await expect(karty).toHaveCount(i + 1, { timeout: 15_000 });
  }
}

function scrollLeftOf(pasek: Locator): Promise<number> {
  return pasek.evaluate((element) => element.scrollLeft);
}

test('ciasny pasek dostaje strzałki, a klik przewija karty w obie strony', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();

  const dok = page.locator('[data-testid=right-dock]');
  const karty = dok.locator('.dock-tab');
  const pasek = dok.locator('.dock-tabs');

  // Jedna karta mieści się swobodnie — strzałki nie zabierają miejsca.
  await page.getByTestId('right-new-terminal').click();
  await expect(karty).toHaveCount(1);
  await expect(page.getByTestId('right-tabs-left')).toHaveCount(0);
  await expect(page.getByTestId('right-tabs-right')).toHaveCount(0);

  // Nowa karta wjeżdża w widok, więc pasek stoi na końcu: brakuje tego z lewej.
  const wLewo = page.getByTestId('right-tabs-left');
  await dokladajKarty(page, karty, 1, () => wLewo.isVisible());
  await expect(wLewo).toBeVisible();
  await expect.poll(() => scrollLeftOf(pasek)).toBeGreaterThan(0);

  const naKoncu = await scrollLeftOf(pasek);
  await wLewo.click();
  await expect.poll(() => scrollLeftOf(pasek)).toBeLessThan(naKoncu);
  // Po cofnięciu jest dokąd wracać — pokazuje się druga strzałka.
  const wPrawo = page.getByTestId('right-tabs-right');
  await expect(wPrawo).toBeVisible();
  await page.screenshot({ path: 'e2e-artifacts/m107-strzalki-kart.png' });

  const poCofnieciu = await scrollLeftOf(pasek);
  await wPrawo.click();
  await expect.poll(() => scrollLeftOf(pasek)).toBeGreaterThan(poCofnieciu);

  await app.close();
});

test('strzałka niesie kolor karty, która wyjechała za krawędź', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject(), {
    VISUALN3O_PATH_PREPEND: makeClaudeBin(),
  });
  const page = await app.firstWindow();

  const dok = page.locator('[data-testid=right-dock]');
  const karty = dok.locator('.dock-tab');

  await page.getByTestId('right-new-claude').click();
  await expect(dok.locator('.xterm')).toContainText('atrapa M107', { timeout: 15_000 });
  await expect(karty.first()).toHaveAttribute('data-status', 'idle', { timeout: 15_000 });

  // Sesja Claude zostaje pierwsza w pasku i wyjeżdża poza widok — sygnał
  // „skończone" (M100) przejmuje wtedy strzałka, inaczej przepadłby z oczu.
  const wLewo = page.getByTestId('right-tabs-left');
  await dokladajKarty(
    page,
    karty,
    1,
    async () => (await wLewo.count()) > 0 && (await wLewo.getAttribute('data-signal')) === 'done',
  );
  await expect(wLewo).toHaveAttribute('data-signal', 'done', { timeout: 15_000 });

  // Sam atrybut to za mało — sprawdzamy kolor, którym strzałka naprawdę świeci
  // (dominująca składowa, jak przy kartach w M100).
  const kolor = await wLewo.evaluate((element) => getComputedStyle(element).color);
  const [r = 0, g = 0, b = 0] = (kolor.match(/[\d.]+/g) ?? []).map(Number);
  expect(g).toBeGreaterThan(r);
  expect(g).toBeGreaterThan(b);
  await page.screenshot({ path: 'e2e-artifacts/m107-strzalka-sygnal.png' });

  await app.close();
});
