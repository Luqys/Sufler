import { expect, test } from '@playwright/test';
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

const GIT = 'git -c user.email=e2e@vn3o.test -c user.name=e2e';

/** Repozytorium z historią i z DUŻĄ liczbą zmian roboczych naraz. */
function makeBusyProject(): string {
  const project = makeFixtureProject();
  for (let index = 0; index < 6; index += 1) {
    writeFileSync(join(project, `plik${index}.txt`), `wersja 1 pliku ${index}\n`);
  }
  execSync(`${GIT} add -A && ${GIT} commit -q -m "sześć plików"`, {
    cwd: project,
    stdio: 'ignore',
    shell: '/bin/zsh',
  });
  for (let index = 0; index < 5; index += 1) {
    execSync(`${GIT} commit -q --allow-empty -m "commit historii ${index}"`, {
      cwd: project,
      stdio: 'ignore',
      shell: '/bin/zsh',
    });
  }
  // 40 zmian roboczych — tyle wystarczy, żeby zepchnąć historię poza panel.
  for (let index = 0; index < 40; index += 1) {
    writeFileSync(join(project, `zmiana${index}.txt`), 'nowy plik\n');
  }
  return project;
}

test('M102: zmiany i historia w osobnych podzakładkach, każda na pełnej wysokości', async () => {
  const project = makeBusyProject();
  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();

  await page.getByTestId('rail-git').click();
  const panel = page.getByTestId('git-panel');
  await expect(panel).toBeVisible();

  // Zmiany robocze to podzakładka domyślna — czterdzieści plików z licznikiem.
  const changes = page.getByTestId('git-changes');
  await expect(changes).toBeVisible();
  await expect(page.getByTestId('git-change-file')).toHaveCount(40);
  // Od M102 lista bierze całą wysokość panelu, bo nie dzieli jej już z historią.
  const panelBox = await panel.boundingBox();
  const changesBox = await changes.boundingBox();
  expect(changesBox!.height).toBeGreaterThan(panelBox!.height * 0.6);
  // Historia siedzi w drugiej podzakładce, więc tu jej nie widać.
  await expect(page.getByTestId('git-commit').first()).toBeHidden();
  await page.screenshot({ path: 'e2e-artifacts/m93-zmiany-robocze.png' });

  // Podzakładka historii: commity widoczne bez przewijania, zmiany schowane.
  await page.getByTestId('rail-git-history').click();
  const commits = page.getByTestId('git-commit');
  await expect(commits.first()).toBeVisible();
  await expect(commits.first()).toContainText('commit historii 4');
  await expect(changes).toBeHidden();
  const listBox = await page.locator('.git-list').boundingBox();
  expect(listBox!.height).toBeGreaterThan(panelBox!.height * 0.6);
  await page.screenshot({ path: 'e2e-artifacts/m93-historia-widoczna.png' });

  // Trzecia podzakładka: punkty przywracania i worktree'y.
  await page.getByTestId('rail-git-points').click();
  await expect(page.getByTestId('checkpoints')).toBeVisible();
  await expect(page.getByTestId('worktrees')).toBeVisible();
  await expect(commits.first()).toBeHidden();
  await page.screenshot({ path: 'e2e-artifacts/m93-punkty-worktreey.png' });

  await app.close();
});
