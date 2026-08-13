import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

/**
 * Lista ostatnich projektów mieszka w state.json i zapełnia ją dopiero jawne
 * przełączenie projektu. Uruchomienie z VISUALN3O_ROOT jej nie dotyka, więc
 * w teście wpisujemy ją wprost — tak samo jak inne spece podstawiają motyw.
 */
function makeConfigHomeWithRecents(roots: string[]): string {
  const dir = makeConfigHome();
  mkdirSync(join(dir, 'sufler'), { recursive: true });
  writeFileSync(join(dir, 'sufler', 'state.json'), JSON.stringify({ recentRoots: roots }, null, 2));
  return dir;
}

test('M87: paleta przełącza projekt bez powrotu na ekran startowy', async () => {
  const pierwszy = makeFixtureProject();
  const drugi = makeFixtureProject();
  // Znacznik, po którym poznamy, że drzewo pokazuje już DRUGI projekt.
  writeFileSync(join(drugi, 'ZNACZNIK-DRUGIEGO.md'), '# drugi projekt\n');

  const configHome = makeConfigHomeWithRecents([drugi, pierwszy]);

  const app = await launchApp(configHome, pierwszy);
  const page = await app.firstWindow();
  await expect(page.getByTestId('workbench')).toBeVisible();
  await expect(page.getByTestId('file-tree')).not.toContainText('ZNACZNIK-DRUGIEGO.md');

  await page.keyboard.press('Meta+k');
  await expect(page.getByTestId('command-palette')).toBeVisible();
  // Grupa „Projekty" z ostatnio otwartymi i wejściem do wyboru katalogu.
  await expect(page.getByTestId('command-palette')).toContainText('Projekty');

  await page.getByTestId('command-palette-input').fill(basename(drugi));
  const items = page.getByTestId('command-palette-item');
  await expect(items.first()).toContainText(basename(drugi));

  await page.screenshot({ path: 'e2e-artifacts/m87-projekty-paleta.png' });
  await page.keyboard.press('Enter');

  // Projekt przełączony w tym samym oknie: drzewo pokazuje znacznik drugiego.
  await expect(page.getByTestId('command-palette')).toBeHidden();
  await expect(page.getByTestId('file-tree')).toContainText('ZNACZNIK-DRUGIEGO.md', {
    timeout: 15_000,
  });
  await expect(page.getByTestId('workbench')).toBeVisible();

  await page.screenshot({ path: 'e2e-artifacts/m87-po-przelaczeniu.png' });
  await app.close();
});

test('M87: bieżący projekt nie pojawia się na liście do przełączenia', async () => {
  const projekt = makeFixtureProject();
  const configHome = makeConfigHomeWithRecents([projekt]);

  const app = await launchApp(configHome, projekt);
  const page = await app.firstWindow();
  await expect(page.getByTestId('workbench')).toBeVisible();

  await page.keyboard.press('Meta+k');
  await page.getByTestId('command-palette-input').fill(basename(projekt));
  // Zostaje samo „Otwórz inny projekt…", bez wpisu prowadzącego donikąd.
  await expect(page.getByTestId('command-palette-item')).toHaveCount(0);

  await app.close();
});
