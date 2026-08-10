/// <reference lib="dom" />
import { expect, test, type ElectronApplication } from '@playwright/test';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

function listPtyPids(app: ElectronApplication): Promise<number[]> {
  return app.evaluate(() => {
    const list = (globalThis as Record<string, unknown>)['vn3oListPtyPids'];
    return typeof list === 'function' ? (list as () => number[])() : [];
  });
}

test('wyciągnięcie karty poza okno otwiera sesję w nowym oknie z zachowanym scrollbackiem', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();

  await page.getByTestId('bottom-dock-add').click();
  await page.getByTestId('bottom-menu-new-terminal').click();
  const terminal = page.locator('[data-testid=bottom-dock] .xterm');
  await expect(terminal).toBeVisible();
  await page.keyboard.type('echo przed-detach-$((90+9))');
  await page.keyboard.press('Enter');
  await expect(terminal).toContainText('przed-detach-99', { timeout: 15_000 });

  expect(await listPtyPids(app)).toHaveLength(1);

  // Przeciągnięcie daleko poza okno → nowe okno z tą samą sesją.
  const tab = page.locator('[data-testid=bottom-dock] .dock-tab').first();
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  const windowPromise = app.waitForEvent('window');
  await tab.dispatchEvent('dragstart', { dataTransfer });
  await tab.dispatchEvent('dragend', { dataTransfer, screenX: 20000, screenY: 20000 });

  const detached = await windowPromise;
  await expect(detached.getByTestId('detached-terminal')).toBeVisible();
  // Scrollback przeniesiony…
  await expect(detached.locator('.xterm')).toContainText('przed-detach-99', {
    timeout: 15_000,
  });
  // …a karta zniknęła z doku, proces żyje.
  await expect(page.locator('[data-testid=bottom-dock] .dock-tab')).toHaveCount(0);
  expect(await listPtyPids(app)).toHaveLength(1);

  // Sesja w nowym oknie nadal działa.
  await detached.locator('.xterm').click();
  await detached.keyboard.type('echo po-detach-$((40+4))');
  await detached.keyboard.press('Enter');
  await expect(detached.locator('.xterm')).toContainText('po-detach-44', { timeout: 15_000 });

  await detached.screenshot({ path: 'e2e-artifacts/m19-odczepione-okno.png' });

  // Zamknięcie odczepionego okna ubija proces (jak zamknięcie karty).
  await detached.close();
  await expect.poll(() => listPtyPids(app), { timeout: 10_000 }).toEqual([]);

  await app.close();
});
