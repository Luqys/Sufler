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

test('M93: historia commitów zostaje widoczna mimo czterdziestu zmian roboczych', async () => {
  const project = makeBusyProject();
  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();

  await page.getByTestId('rail-git').click();
  const panel = page.getByTestId('git-panel');
  await expect(panel).toBeVisible();

  // Lista zmian z licznikiem i własnym przewijaniem.
  const changes = page.getByTestId('git-changes');
  await expect(changes).toBeVisible();
  await expect(page.getByTestId('git-change-file')).toHaveCount(40);

  // NAJWAŻNIEJSZE: mimo tylu zmian widać commity, i to bez przewijania panelu.
  const commits = page.getByTestId('git-commit');
  await expect(commits.first()).toBeVisible();
  await expect(commits.first()).toContainText('commit historii 4');

  // Lista zmian nie zjada całej wysokości panelu.
  const panelBox = await panel.boundingBox();
  const changesBox = await changes.boundingBox();
  expect(changesBox!.height).toBeLessThan(panelBox!.height * 0.6);

  // A historia ma realną wysokość, nie kilka pikseli.
  const listBox = await page.locator('.git-list').boundingBox();
  expect(listBox!.height).toBeGreaterThan(90);

  await page.screenshot({ path: 'e2e-artifacts/m93-historia-widoczna.png' });
  await app.close();
});
