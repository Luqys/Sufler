import { expect, test } from '@playwright/test';
import { launchApp, makeConfigHome, makeFakeClaudeBin, makeFixtureProject } from './utils';

test('przełączniki na pasku tytułu zwijają i rozwijają wszystkie panele', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();
  await expect(page.getByTestId('workbench')).toBeVisible();

  const cases = [
    { toggle: 'layout-toggle-sidebar', panel: 'sidebar' },
    { toggle: 'layout-toggle-bottom', panel: 'bottom-dock' },
    { toggle: 'layout-toggle-right', panel: 'right-dock' },
  ] as const;

  for (const { toggle, panel } of cases) {
    await expect(page.getByTestId(panel)).toBeVisible();
    await expect(page.getByTestId(toggle)).toHaveAttribute('aria-pressed', 'true');

    await page.getByTestId(toggle).click();
    await expect(page.getByTestId(panel)).toHaveCount(0);
    await expect(page.getByTestId(toggle)).toHaveAttribute('aria-pressed', 'false');

    // Rozwijanie tym samym przyciskiem — panel wraca.
    await page.getByTestId(toggle).click();
    await expect(page.getByTestId(panel)).toBeVisible();
    await expect(page.getByTestId(toggle)).toHaveAttribute('aria-pressed', 'true');
  }

  await page.screenshot({ path: 'e2e-artifacts/m12-przelaczniki-paska.png' });
  await app.close();
});

test('ikonka Claude na pasku otwiera widżet logowania, a zamknięcie ubija proces', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject(), {
    VISUALN3O_PATH_PREPEND: makeFakeClaudeBin(),
  });
  const page = await app.firstWindow();
  await expect(page.getByTestId('workbench')).toBeVisible();

  await page.getByTestId('claude-login-button').click();
  const dialog = page.getByTestId('login-dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText('Zaloguj się do Claude');
  await expect(dialog.locator('.xterm')).toContainText('TRYB-LOGOWANIA', { timeout: 15_000 });

  const pids = await app.evaluate(() => {
    const list = (globalThis as Record<string, unknown>)['vn3oListPtyPids'];
    return typeof list === 'function' ? (list as () => number[])() : [];
  });
  expect(pids).toHaveLength(1);

  await page.screenshot({ path: 'e2e-artifacts/m12-logowanie-claude.png' });

  await page.getByTestId('login-close').click();
  await expect(dialog).toHaveCount(0);
  await expect
    .poll(() =>
      app.evaluate(() => {
        const list = (globalThis as Record<string, unknown>)['vn3oListPtyPids'];
        return typeof list === 'function' ? (list as () => number[])() : [];
      }),
    )
    .toEqual([]);

  await app.close();
});
