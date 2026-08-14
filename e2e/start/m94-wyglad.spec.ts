import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFakeClaudeBin, makeFixtureProject } from '../utils';

/** Kolor obliczony elementu — sprawdzamy wygląd, a nie treść klasy. */
async function styl(page: import('@playwright/test').Page, selektor: string, wlasciwosc: string) {
  return page.evaluate(
    ([sel, prop]) => {
      const el = document.querySelector(sel as string);
      return el ? getComputedStyle(el).getPropertyValue(prop as string).trim() : '';
    },
    [selektor, wlasciwosc],
  );
}

test('M94: hierarchia przycisków i plakietek — równorzędny pasek akcji, ciche plakietki', async () => {
  const project = makeFixtureProject();
  mkdirSync(join(project, '.claude', 'skills', 'przykladowy'), { recursive: true });
  writeFileSync(
    join(project, '.claude', 'skills', 'przykladowy', 'SKILL.md'),
    '---\nname: przykladowy\ndescription: Skill do zrzutu ekranu\n---\n\nTreść.\n',
  );

  const app = await launchApp(makeConfigHome(), project, {
    VISUALN3O_PATH_PREPEND: makeFakeClaudeBin(),
  });
  const page = await app.firstWindow();
  await expect(page.getByTestId('workbench')).toBeVisible();

  await page.getByTestId('rail-skills').click();
  await expect(page.getByTestId('skills-panel')).toBeVisible();

  /*
   * Od M103 trzy akcje tworzenia są równorzędne i siedzą w jednym pasku
   * segmentowanym: ta sama waga pisma i żadnych obwódek. Sprawdzamy SZEROKOŚĆ
   * obwódki, nie kolor: przy `border: none` przeglądarka liczy `border-*-color`
   * jako kolor tekstu, więc kolor nic o obwódce nie mówi (pierwsza wersja tego
   * testu padła właśnie na tym).
   */
  const wagi = await Promise.all(
    ['skills-new', 'agents-new', 'rules-new'].map((id) =>
      styl(page, `[data-testid=${id}]`, 'font-weight'),
    ),
  );
  expect(new Set(wagi).size).toBe(1);
  const obwodka = await styl(page, '[data-testid=agents-new]', 'border-top-width');
  expect(obwodka === '0px' || obwodka === '').toBe(true);

  // Etykiety mieszczą się w jednym wierszu — żadna się nie łamie.
  for (const id of ['skills-new', 'agents-new', 'rules-new']) {
    const wysokosc = (await page.getByTestId(id).boundingBox())!.height;
    expect(wysokosc).toBeLessThan(34);
  }

  // Plakietka nie udaje przycisku: bez obwódki.
  const plakietkaBorder = await styl(page, '.badge', 'border-style');
  expect(plakietkaBorder === 'none' || plakietkaBorder === '').toBe(true);

  await page.screenshot({ path: 'e2e-artifacts/m94-panel-skilli.png' });

  await page.getByTestId('rail-mcp').click();
  await page.screenshot({ path: 'e2e-artifacts/m94-panel-mcp.png' });

  await app.close();
});

test('M94: dialog ma jedną akcję główną w kolorze motywu, nie zaszytą czerwień', async () => {
  const project = makeFixtureProject();
  const app = await launchApp(makeConfigHome(), project, {
    VISUALN3O_PATH_PREPEND: makeFakeClaudeBin(),
  });
  const page = await app.firstWindow();

  // Sesja Claude z działającym procesem → zamknięcie karty pyta dialogiem.
  await page.getByTestId('right-new-claude').click();
  await expect(page.locator('[data-testid=right-dock] .xterm')).toBeVisible({ timeout: 15_000 });
  await page.locator('[data-testid=right-dock] .dock-tab .tab-close').click();

  const dialog = page.getByTestId('confirm-dialog');
  await expect(dialog).toBeVisible();

  // Zatwierdzenie: wypełnienie, nie obwódka; „Anuluj": bez obwódki.
  const akceptTlo = await styl(page, '[data-testid=confirm-accept]', 'background-color');
  const anulujBorder = await styl(page, '[data-testid=confirm-cancel]', 'border-top-color');
  expect(akceptTlo).not.toBe('rgba(0, 0, 0, 0)');
  expect(anulujBorder).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);

  await page.screenshot({ path: 'e2e-artifacts/m94-dialog.png' });

  await page.getByTestId('confirm-cancel').click();
  await expect(dialog).toBeHidden();
  await app.close();
});
