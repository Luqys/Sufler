/// <reference lib="dom" />
import { expect, test, type Locator } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

/**
 * Atrapa Claude z trzema wyjściami: pytanie o zgodę, praca zakończona
 * i śmierć z kodem 3 — dokładnie te trzy stany kolorują kartę.
 */
function makeClaudeBin(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vn3o-bin-'));
  const script = `#!/bin/zsh
echo "── Claude Code (atrapa) ──"
echo "? for shortcuts"
while IFS= read -r line; do
  if [[ "$line" == perm* ]]; then
    echo "Do you want to allow this tool?"
    echo "  1. Yes"
  elif [[ "$line" == boom* ]]; then
    echo "blad krytyczny"
    exit 3
  else
    echo "esc to interrupt"
    sleep 0.2
    echo "odpowiedz: $line"
    echo "? for shortcuts"
  fi
done
`;
  writeFileSync(join(dir, 'claude'), script, { mode: 0o755 });
  return dir;
}

/** Kanały tła karty — kolor sprawdzamy po dominującej składowej, nie po zapisie. */
async function tlo(tab: Locator): Promise<{ r: number; g: number; b: number; a: number }> {
  const value = await tab.evaluate((element) => getComputedStyle(element).backgroundColor);
  const parts = value.match(/[\d.]+/g) ?? [];
  return {
    r: Number(parts[0] ?? 0),
    g: Number(parts[1] ?? 0),
    b: Number(parts[2] ?? 0),
    a: Number(parts[3] ?? 1),
  };
}

test('karta Claude świeci stanem: niebiesko przy pytaniu, zielono po pracy, czerwono po błędzie', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject(), {
    VISUALN3O_PATH_PREPEND: makeClaudeBin(),
  });
  const page = await app.firstWindow();

  await page.getByTestId('bottom-new-claude').click();
  const dock = page.locator('[data-testid=bottom-dock]');
  const terminal = dock.locator('.xterm');
  await expect(terminal).toContainText('atrapa', { timeout: 15_000 });
  const tab = dock.locator('.dock-tab').first();

  // Prompt bez pracy = skończone: zielona karta.
  await expect(tab).toHaveAttribute('data-status', 'idle', { timeout: 15_000 });
  const zielone = await tlo(tab);
  expect(zielone.a).toBeGreaterThan(0);
  expect(zielone.g).toBeGreaterThan(zielone.r);

  // Pytanie o zgodę: niebieska karta.
  await terminal.click();
  await page.keyboard.type('perm');
  await page.keyboard.press('Enter');
  await expect(tab).toHaveAttribute('data-status', 'needs-input', { timeout: 15_000 });
  const niebieskie = await tlo(tab);
  expect(niebieskie.b).toBeGreaterThan(niebieskie.r);
  expect(niebieskie.b).toBeGreaterThan(niebieskie.g);
  await page.screenshot({ path: 'e2e-artifacts/m100-karta-niebieska.png' });

  // Zgoda odebrana → znów zielono.
  await page.keyboard.type('dalej');
  await page.keyboard.press('Enter');
  await expect(tab).toHaveAttribute('data-status', 'idle', { timeout: 15_000 });

  // Zgon procesu z kodem 3: czerwona karta i przekreślony tytuł.
  await page.keyboard.type('boom');
  await page.keyboard.press('Enter');
  await expect(tab).toHaveAttribute('data-failed', 'true', { timeout: 15_000 });
  const czerwone = await tlo(tab);
  expect(czerwone.r).toBeGreaterThan(czerwone.g);
  expect(czerwone.r).toBeGreaterThan(czerwone.b);
  await page.screenshot({ path: 'e2e-artifacts/m100-karta-czerwona.png' });

  // Wyłączniki dźwięku i powiadomień są w Ustawieniach, domyślnie włączone.
  await page.getByTestId('settings-button').click();
  await page.getByTestId('notify-section').scrollIntoViewIfNeeded();
  await expect(page.getByTestId('notify-sounds')).toBeChecked();
  await expect(page.getByTestId('notify-system')).toBeChecked();
  await page.screenshot({ path: 'e2e-artifacts/m100-ustawienia-dzwieki.png' });

  await app.close();
});

test('zwykły terminal zostaje szary — kolorem mówią tylko sesje Claude', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();

  await page.getByTestId('bottom-new-terminal').click();
  const dock = page.locator('[data-testid=bottom-dock]');
  await expect(dock.locator('.xterm')).toBeVisible();
  const tab = dock.locator('.dock-tab').first();
  await expect(tab).toHaveAttribute('data-kind', 'terminal');

  const { r, g, b } = await tlo(tab);
  expect(Math.abs(r - g)).toBeLessThan(12);
  expect(Math.abs(g - b)).toBeLessThan(12);

  await app.close();
});
