import { expect, test } from '@playwright/test';
import { execSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFakeClaudeBin, makeFixtureProject } from '../utils';

const GIT = 'git -c user.email=e2e@vn3o.test -c user.name=e2e';

test('M72: worktree z panelu — sesja startuje w nim, praca wraca scaleniem', async () => {
  const project = makeFixtureProject();
  const app = await launchApp(makeConfigHome(), project, {
    VISUALN3O_PATH_PREPEND: makeFakeClaudeBin(),
  });
  const page = await app.firstWindow();

  await page.getByTestId('rail-git').click();
  const section = page.getByTestId('worktrees');
  await expect(section).toBeVisible();
  // Na starcie jest tylko katalog główny projektu.
  await expect(page.getByTestId('worktree-row')).toHaveCount(1);
  await expect(page.getByTestId('worktree-row').first()).toContainText('projekt');

  // Nazwa niepoprawna dla gita nie odblokowuje przycisku.
  await page.getByTestId('worktree-name').fill('zła nazwa');
  await expect(page.getByTestId('worktree-new')).toBeDisabled();

  await page.getByTestId('worktree-name').fill('m82-eksperyment');
  await expect(page.getByTestId('worktree-new')).toBeEnabled();
  await page.getByTestId('worktree-new').click();

  // Nowy wiersz na liście i katalog OBOK projektu, nie w środku.
  const row = page.locator('[data-testid=worktree-row]', { hasText: 'm82-eksperyment' });
  await expect(row).toBeVisible({ timeout: 15_000 });
  const worktreePath = `${project}-worktrees/m82-eksperyment`;
  expect(existsSync(worktreePath)).toBe(true);
  expect(existsSync(join(project, 'm82-eksperyment'))).toBe(false);

  // Sesja Claude wstaje od razu i pracuje w katalogu worktree'a.
  const terminal = page.locator('[data-testid=right-dock] .xterm');
  await expect(terminal).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-testid=right-dock] .dock-tab')).toContainText('m82-eksperyment');

  await page.screenshot({ path: 'e2e-artifacts/m72-worktree.png' });

  // Praca w worktree: commit z zewnątrz, tak jak zrobiłaby to sesja Claude.
  writeFileSync(join(worktreePath, 'z-worktree.txt'), 'praca równoległa\n');
  execSync(`${GIT} add -A && ${GIT} commit -q -m "praca w worktree"`, {
    cwd: worktreePath,
    stdio: 'ignore',
    shell: '/bin/zsh',
  });

  // Scalenie wciąga ją do gałęzi projektu.
  await row.getByTestId('worktree-merge').click();
  await page.getByTestId('confirm-accept').click();
  await expect.poll(() => existsSync(join(project, 'z-worktree.txt')), { timeout: 15_000 }).toBe(
    true,
  );

  await page.screenshot({ path: 'e2e-artifacts/m72-worktree-scalony.png' });
  await app.close();
});

test('M72: usunięcie pyta o zgodę i nie rusza worktree z niezapisanymi zmianami', async () => {
  const project = makeFixtureProject();
  const app = await launchApp(makeConfigHome(), project, {
    VISUALN3O_PATH_PREPEND: makeFakeClaudeBin(),
  });
  const page = await app.firstWindow();

  await page.getByTestId('rail-git').click();
  await page.getByTestId('worktree-name').fill('m82-do-usuniecia');
  await page.getByTestId('worktree-new').click();

  const row = page.locator('[data-testid=worktree-row]', { hasText: 'm82-do-usuniecia' });
  await expect(row).toBeVisible({ timeout: 15_000 });
  const worktreePath = `${project}-worktrees/m82-do-usuniecia`;

  // Niezapisany plik w worktree — usunięcie ma się zatrzymać.
  writeFileSync(join(worktreePath, 'brudny.txt'), 'niezapisane\n');
  await row.getByTestId('worktree-remove').click();
  await page.getByTestId('confirm-accept').click();
  await expect(row).toBeVisible();
  expect(existsSync(worktreePath)).toBe(true);

  // Po posprzątaniu usunięcie przechodzi. Czekamy, aż zniknie toast z odmową —
  // wjeżdżając i znikając przesuwa układ, a Playwright wymaga stabilnej pozycji.
  await expect(page.getByTestId('toast')).toHaveCount(0, { timeout: 15_000 });
  execSync('git clean -fd', { cwd: worktreePath, stdio: 'ignore' });
  await row.getByTestId('worktree-remove').click();
  await page.getByTestId('confirm-accept').click();
  await expect(row).toHaveCount(0, { timeout: 15_000 });
  expect(existsSync(worktreePath)).toBe(false);

  await app.close();
});
