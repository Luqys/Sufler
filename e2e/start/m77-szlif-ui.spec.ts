import { expect, test } from '@playwright/test';
import { launchApp, makeConfigHome, makeFakeClaudeBin, makeFixtureProject } from '../utils';

/**
 * M77 — zgłoszenia z pracy z aplikacją: logo na starcie, panel Sesje bez
 * wykresu, szlif nakładki grafu i podział doku przeciągnięciem karty
 * do krawędzi panelu.
 */

test('przeciągnięcie karty do prawej krawędzi dzieli dok na dwie sesje obok siebie', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject(), {
    VISUALN3O_PATH_PREPEND: makeFakeClaudeBin(),
  });
  const page = await app.firstWindow();

  // Dwie sesje Claude w jednym panelu dolnego doku.
  await page.getByTestId('bottom-new-claude').click();
  await page.getByTestId('bottom-new-claude').click();
  const panes = page.locator('[data-testid=bottom-dock] .dock-pane');
  await expect(panes).toHaveCount(1);
  await expect(page.locator('[data-testid=bottom-dock] .dock-tab')).toHaveCount(2);

  const tab = page.locator('[data-testid=bottom-dock] .dock-tab').nth(1);
  const pane = page.getByTestId('bottom-pane-0');
  const box = await pane.boundingBox();
  if (!box) {
    throw new Error('panel bez geometrii');
  }
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await tab.dispatchEvent('dragstart', { dataTransfer });

  // Środek panelu = wejście do panelu; podgląd podziału się nie pokazuje.
  await pane.dispatchEvent('dragover', {
    dataTransfer,
    clientX: box.x + box.width / 2,
    clientY: box.y + box.height / 2,
  });
  await expect(pane).toHaveAttribute('data-drop-zone', 'center');

  // Prawa krawędź = nowy panel obok, z podglądem przed puszczeniem.
  const rightEdge = { clientX: box.x + box.width - 8, clientY: box.y + box.height / 2 };
  await pane.dispatchEvent('dragover', { dataTransfer, ...rightEdge });
  await expect(pane).toHaveAttribute('data-drop-zone', 'after');
  await page.screenshot({ path: 'e2e-artifacts/m77-podglad-podzialu.png' });

  await pane.dispatchEvent('drop', { dataTransfer, ...rightEdge });

  // Dwa panele, po jednej sesji w każdym — dwa terminale widoczne naraz.
  await expect(panes).toHaveCount(2);
  await expect(page.locator('[data-testid=bottom-pane-0] .dock-tab')).toHaveCount(1);
  await expect(page.locator('[data-testid=bottom-pane-1] .dock-tab')).toHaveCount(1);
  await expect(page.locator('[data-testid=bottom-dock] .xterm')).toHaveCount(2);

  await page.screenshot({ path: 'e2e-artifacts/m77-podzial-przeciagnieciem.png' });
  await app.close();
});

test('ekran startowy pokazuje ikonę aplikacji, nie osobny rysunek', async () => {
  const app = await launchApp(makeConfigHome());
  const page = await app.firstWindow();
  await expect(page.getByTestId('welcome')).toBeVisible();

  const logo = page.getByTestId('welcome-logo');
  await expect(logo).toBeVisible();
  // Ta sama grafika co ikona aplikacji (build/icon.png), a nie inline SVG.
  const info = await logo.evaluate((node) => {
    const image = node as HTMLImageElement;
    return { src: image.currentSrc, width: image.naturalWidth, height: image.naturalHeight };
  });
  expect(info.src).toContain('logo');
  expect(info.width).toBe(256);
  expect(info.height).toBe(256);
  await expect(page.locator('.welcome-mark svg')).toHaveCount(0);

  await app.close();
});

test('panel Sesje bez wykresu dobowego; pasek grafu w jednej metryce', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();

  await page.getByTestId('rail-sessions').click();
  await expect(page.getByTestId('sessions-panel')).toBeVisible();
  // Słupki wykresu zniknęły (zgłoszenie: „wykres jest kompletnie zbędny").
  await expect(page.locator('[data-testid=usage-bars]')).toHaveCount(0);
  await expect(page.locator('[data-testid=usage-bar]')).toHaveCount(0);

  // Pasek grafu (M105): licznik, szukajka, tryby i przyciski w jednej metryce.
  await page.getByTestId('rail-knowledge').click();
  await expect(page.getByTestId('graph-stats')).toBeVisible();
  const heights = await page
    .locator('.graph-bar > *')
    .evaluateAll((nodes) => nodes.map((node) => Math.round(node.getBoundingClientRect().height)));
  expect(heights.length).toBeGreaterThanOrEqual(4);
  expect([...new Set(heights)]).toHaveLength(1);

  await page.screenshot({ path: 'e2e-artifacts/m77-nakladka-grafu.png' });
  await app.close();
});
