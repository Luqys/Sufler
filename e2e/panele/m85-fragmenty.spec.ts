import { expect, test } from '@playwright/test';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

const GIT = 'git -c user.email=e2e@vn3o.test -c user.name=e2e';

/** Plik na tyle długi, żeby dwie odległe zmiany dały dwa osobne hunki. */
function makeLongFile(project: string): void {
  const lines = Array.from({ length: 30 }, (_, index) => `wiersz ${index + 1}`);
  writeFileSync(join(project, 'dlugi.txt'), lines.join('\n') + '\n');
  execSync(`${GIT} add -A && ${GIT} commit -q -m "długi plik"`, {
    cwd: project,
    stdio: 'ignore',
    shell: '/bin/zsh',
  });
}

function makeTwoChanges(project: string): void {
  const lines = readFileSync(join(project, 'dlugi.txt'), 'utf8').split('\n');
  lines[1] = 'ZMIANA NA GORZE';
  lines[24] = 'ZMIANA NA DOLE';
  writeFileSync(join(project, 'dlugi.txt'), lines.join('\n'));
}

test('M85: zatwierdzenie jednego fragmentu zostawia drugi w drzewie', async () => {
  const project = makeFixtureProject();
  makeLongFile(project);
  execSync('git config user.email e2e@vn3o.test && git config user.name e2e', {
    cwd: project,
    stdio: 'ignore',
    shell: '/bin/zsh',
  });
  makeTwoChanges(project);

  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();

  await page.getByTestId('rail-git').click();
  const row = page.locator('.git-change-item', { hasText: 'dlugi.txt' });
  await expect(row).toBeVisible();

  // Rozwinięcie fragmentów: dwie odległe zmiany to dwa hunki.
  await row.getByTestId('git-hunks-toggle').click();
  const hunks = row.getByTestId('git-hunk');
  await expect(hunks).toHaveCount(2, { timeout: 15_000 });
  await expect(hunks.first()).toContainText('wiersz 2');
  await expect(hunks.first()).toContainText('+1');

  // Zaznaczenie pierwszego fragmentu wyklucza zaznaczenie całego pliku.
  await row.getByTestId('git-change-check').check();
  await hunks.first().getByTestId('git-hunk-check').check();
  await expect(row.getByTestId('git-change-check')).not.toBeChecked();

  await page.getByTestId('git-commit-message').fill('Tylko górna zmiana');
  const commitButton = page.getByTestId('git-commit-btn');
  await expect(commitButton).toBeEnabled();

  await page.screenshot({ path: 'e2e-artifacts/m85-fragmenty.png' });
  await commitButton.click();

  // W commicie jest górna zmiana, dolna została w drzewie roboczym.
  await expect
    .poll(
      () => execSync('git show HEAD:dlugi.txt', { cwd: project, encoding: 'utf8' }),
      { timeout: 15_000 },
    )
    .toContain('ZMIANA NA GORZE');
  const committed = execSync('git show HEAD:dlugi.txt', { cwd: project, encoding: 'utf8' });
  expect(committed).not.toContain('ZMIANA NA DOLE');
  expect(execSync('git diff -- dlugi.txt', { cwd: project, encoding: 'utf8' })).toContain(
    'ZMIANA NA DOLE',
  );
  expect(execSync('git log -1 --format=%s', { cwd: project, encoding: 'utf8' }).trim()).toBe(
    'Tylko górna zmiana',
  );

  // Plik nadal jest na liście zmian — reszta pracy czeka.
  await expect(page.locator('.git-change-item', { hasText: 'dlugi.txt' })).toBeVisible();
  await expect(page.getByTestId('git-commit-message')).toHaveValue('');

  await page.screenshot({ path: 'e2e-artifacts/m85-po-zatwierdzeniu.png' });
  await app.close();
});

test('M85: plik nieśledzony nie udaje, że ma fragmenty', async () => {
  const project = makeFixtureProject();
  execSync('git config user.email e2e@vn3o.test && git config user.name e2e', {
    cwd: project,
    stdio: 'ignore',
    shell: '/bin/zsh',
  });
  writeFileSync(join(project, 'nowy.txt'), 'świeży plik\n');

  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();

  await page.getByTestId('rail-git').click();
  const row = page.locator('.git-change-item', { hasText: 'nowy.txt' });
  await expect(row).toBeVisible();
  // Nieśledzony plik nie ma czego dzielić — przycisk fragmentów się nie pojawia.
  await expect(row.getByTestId('git-hunks-toggle')).toHaveCount(0);

  await app.close();
});
