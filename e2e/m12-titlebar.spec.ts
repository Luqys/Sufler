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

test('ikonka Claude na pasku otwiera logowanie w prawym doku (nawet schowanym)', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject(), {
    VISUALN3O_PATH_PREPEND: makeFakeClaudeBin(),
  });
  const page = await app.firstWindow();
  await expect(page.getByTestId('workbench')).toBeVisible();

  // Chowamy prawy dok — przycisk logowania ma go sam rozwinąć.
  await page.getByTestId('right-dock-hide').click();
  await expect(page.getByTestId('right-dock')).toHaveCount(0);

  await page.getByTestId('claude-login-button').click();
  await expect(page.getByTestId('right-dock')).toBeVisible();
  await expect(page.locator('[data-testid=right-dock] .dock-tab')).toContainText('Logowanie');
  await expect(page.locator('[data-testid=right-dock] .xterm')).toContainText('TRYB-LOGOWANIA', {
    timeout: 15_000,
  });

  await page.screenshot({ path: 'e2e-artifacts/m12-logowanie-claude.png' });
  await app.close();
});
