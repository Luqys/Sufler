import { expect, test, type ElectronApplication } from '@playwright/test';
import { launchApp, makeConfigHome, makeFakeClaudeBin, makeFixtureProject } from './utils';

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

test('sesja Claude startuje z menu +, a zamknięcie zakładki ubija proces', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject(), {
    VISUALN3O_PATH_PREPEND: makeFakeClaudeBin(),
  });
  const page = await app.firstWindow();

  await page.getByTestId('right-new-claude').click();
  const terminal = page.locator('[data-testid=right-dock] .xterm');
  await expect(terminal).toBeVisible();
  await expect(terminal).toContainText('Claude Code (atrapa)', { timeout: 15_000 });
  await expect(page.locator('[data-testid=right-dock] .dock-tab')).toContainText('Claude');

  const pids = await listPtyPids(app);
  expect(pids).toHaveLength(1);
  const pid = pids[0] ?? 0;
  expect(isProcessAlive(pid)).toBe(true);

  await page.locator('[data-testid=right-dock] .dock-tab .tab-close').click();
  await page.getByTestId('confirm-accept').click();
  await expect.poll(() => listPtyPids(app)).toEqual([]);
  await expect.poll(() => isProcessAlive(pid), { timeout: 10_000 }).toBe(false);

  await app.close();
});

test('kropki statusu: zielona po skończonej pracy, niebieska przy pytaniu o zgodę', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject(), {
    VISUALN3O_PATH_PREPEND: makeFakeClaudeBin(),
  });
  const page = await app.firstWindow();

  // Sesja Claude w dolnym doku; atrapa od razu zgłasza bezczynność.
  await page.getByTestId('bottom-new-claude').click();
  const claudeTab = page.locator('[data-testid=bottom-dock] .dock-tab').first();
  await expect(claudeTab).toHaveAttribute('data-status', 'idle', { timeout: 15_000 });
  await expect(claudeTab.locator('.status-dot')).toHaveCount(0); // aktywna — bez kropki

  // Drugi tab (terminal) przejmuje aktywność → na zakładce Claude zielona kropka.
  await page.getByTestId('bottom-new-terminal').click();
  await expect(claudeTab.locator('.status-dot.done')).toBeVisible();

  // Wracamy do Claude — kropka znika, prosimy o „zgodę".
  await claudeTab.click();
  await expect(claudeTab.locator('.status-dot')).toHaveCount(0);
  await page.locator('[data-testid=bottom-dock] .xterm').click();
  await page.keyboard.type('perm');
  await page.keyboard.press('Enter');
  await expect(claudeTab).toHaveAttribute('data-status', 'needs-input', { timeout: 15_000 });

  // Odejście na terminal → niebieska kropka na zakładce Claude.
  await page.locator('[data-testid=bottom-dock] .dock-tab').nth(1).click();
  await expect(claudeTab.locator('.status-dot.attention')).toBeVisible();

  await page.screenshot({ path: 'e2e-artifacts/m4-kropki-statusu.png' });
  await app.close();
});
