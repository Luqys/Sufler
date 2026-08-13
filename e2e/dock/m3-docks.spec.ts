/// <reference lib="dom" />
import { expect, test, type ElectronApplication } from '@playwright/test';
import { launchApp, makeConfigHome, makeFixtureProject, wpiszPolecenie } from '../utils';

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function listPtyPids(app: ElectronApplication): Promise<number[]> {
  return app.evaluate(() => {
    const list = (globalThis as Record<string, unknown>)['vn3oListPtyPids'];
    return typeof list === 'function' ? (list as () => number[])() : [];
  });
}

test('terminal w dolnym doku wykonuje polecenie echo', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();

  await page.getByTestId('bottom-new-terminal').click();
  const terminal = page.locator('[data-testid=bottom-dock] .xterm');
  await expect(terminal).toBeVisible();

  await wpiszPolecenie(page, terminal, 'echo vn3o-$((1300+37))');
  await expect(terminal).toContainText('vn3o-1337', { timeout: 15_000 });

  await page.screenshot({ path: 'e2e-artifacts/m3-terminal-echo.png' });
  await app.close();
});

test('zamknięcie zakładki i zamknięcie aplikacji ubijają procesy pty', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();

  await page.getByTestId('bottom-new-terminal').click();
  await expect(page.locator('[data-testid=bottom-dock] .xterm')).toBeVisible();

  const pids = await listPtyPids(app);
  expect(pids).toHaveLength(1);
  const firstPid = pids[0] ?? 0;
  expect(isProcessAlive(firstPid)).toBe(true);

  await page.locator('[data-testid=bottom-dock] .dock-tab .tab-close').click();
  // Wewnętrzny dialog aplikacji (nie systemowy) potwierdza zamknięcie.
  await expect(page.getByTestId('confirm-dialog')).toBeVisible();
  await page.getByTestId('confirm-accept').click();
  await expect.poll(() => listPtyPids(app)).toEqual([]);
  await expect.poll(() => isProcessAlive(firstPid), { timeout: 10_000 }).toBe(false);

  await page.getByTestId('bottom-new-terminal').click();
  await expect(page.locator('[data-testid=bottom-dock] .xterm')).toBeVisible();
  const secondPid = (await listPtyPids(app))[0] ?? 0;
  expect(isProcessAlive(secondPid)).toBe(true);

  await app.close();
  await expect.poll(() => isProcessAlive(secondPid), { timeout: 10_000 }).toBe(false);
});

test('przeciągnięcie zakładki między dokami zachowuje proces i scrollback', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();

  await page.getByTestId('bottom-new-terminal').click();
  const bottomTerminal = page.locator('[data-testid=bottom-dock] .xterm');
  await expect(bottomTerminal).toBeVisible();
  await wpiszPolecenie(page, bottomTerminal, 'echo marker-$((40+2))');
  await expect(bottomTerminal).toContainText('marker-42', { timeout: 15_000 });

  const pidsBefore = await listPtyPids(app);

  const tab = page.locator('[data-testid=bottom-dock] .dock-tab').first();
  const target = page.locator('[data-testid=right-dock] .dock-header');
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await tab.dispatchEvent('dragstart', { dataTransfer });
  await target.dispatchEvent('dragover', { dataTransfer });
  await target.dispatchEvent('drop', { dataTransfer });

  const rightTerminal = page.locator('[data-testid=right-dock] .xterm');
  await expect(rightTerminal).toBeVisible();
  await expect(rightTerminal).toContainText('marker-42');
  await expect(page.locator('[data-testid=bottom-dock] .dock-tab')).toHaveCount(0);

  const pidsAfter = await listPtyPids(app);
  expect(pidsAfter).toEqual(pidsBefore);

  await wpiszPolecenie(page, rightTerminal, 'echo po-przeprowadzce-$((50+5))');
  await expect(rightTerminal).toContainText('po-przeprowadzce-55', { timeout: 15_000 });

  await page.screenshot({ path: 'e2e-artifacts/m3-po-przeciagnieciu.png' });
  await app.close();
});
