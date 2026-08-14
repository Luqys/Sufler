import { expect, test } from '@playwright/test';
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFakeClaudeBin, makeFixtureProject } from '../utils';

const GIT = 'git -c user.email=e2e@vn3o.test -c user.name=e2e';

test('M86: worktree pokazuje, co wniósł wobec gałęzi projektu, a klik otwiera diff', async () => {
  const project = makeFixtureProject();
  const app = await launchApp(makeConfigHome(), project, {
    VISUALN3O_PATH_PREPEND: makeFakeClaudeBin(),
  });
  const page = await app.firstWindow();

  await page.getByTestId('rail-git').click();
  await page.getByTestId('rail-git-points').click();
  await page.getByTestId('worktree-name').fill('m86-praca');
  await page.getByTestId('worktree-new').click();

  const row = page.locator('[data-testid=worktree-row]', { hasText: 'm86-praca' });
  await expect(row).toBeVisible({ timeout: 15_000 });
  const worktreePath = `${project}-worktrees/m86-praca`;

  // Świeża gałąź nie wnosi jeszcze nic — i mówi to wprost.
  await row.getByTestId('worktree-diff').click();
  await expect(page.getByTestId('worktree-diff-empty')).toBeVisible({ timeout: 15_000 });
  await row.getByTestId('worktree-diff').click();

  // Praca w worktree plus RÓWNOLEGŁY commit na gałęzi projektu.
  writeFileSync(join(worktreePath, 'z-worktree.txt'), 'praca równoległa\n');
  writeFileSync(join(worktreePath, 'README.md'), '# Projekt testowy\n\nZmiana z worktree.\n');
  execSync(`${GIT} add -A && ${GIT} commit -q -m "praca w worktree"`, {
    cwd: worktreePath,
    stdio: 'ignore',
    shell: '/bin/zsh',
  });
  writeFileSync(join(project, 'z-maina.txt'), 'cudza praca\n');
  execSync(`${GIT} add -A && ${GIT} commit -q -m "praca na gałęzi projektu"`, {
    cwd: project,
    stdio: 'ignore',
    shell: '/bin/zsh',
  });

  await row.getByTestId('worktree-diff').click();
  const files = page.getByTestId('worktree-diff-file');
  await expect(files).toHaveCount(2, { timeout: 15_000 });
  await expect(files.first()).toContainText('z-worktree.txt');
  await expect(files.nth(1)).toContainText('README.md');
  // Plik z gałęzi bazowej NIE jest wkładem worktree'a — liczymy od rozejścia.
  await expect(page.getByTestId('worktree-diff-list')).not.toContainText('z-maina.txt');

  await page.screenshot({ path: 'e2e-artifacts/m86-worktree-diff.png' });

  // Klik otwiera zakładkę diffa z obiema stronami porównania.
  await files.nth(1).click();
  await expect(page.getByTestId('diff-view')).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId('diff-host')).toBeVisible();
  await expect(page.getByTestId('tab-active')).toContainText('README.md');

  await page.screenshot({ path: 'e2e-artifacts/m86-worktree-diff-otwarty.png' });
  await app.close();
});
