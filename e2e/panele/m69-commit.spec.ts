import { expect, test } from '@playwright/test';
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

/** Autor w konfiguracji repozytorium — commit z aplikacji idzie bez `-c`. */
function setIdentity(project: string): void {
  execSync('git config user.email e2e@vn3o.test', { cwd: project, stdio: 'ignore' });
  execSync('git config user.name e2e', { cwd: project, stdio: 'ignore' });
}

test('M69: zaznaczone pliki zatwierdzają się z panelu, reszta zostaje w drzewie', async () => {
  const project = makeFixtureProject();
  setIdentity(project);
  // Dwie zmiany robocze: jedną zatwierdzamy, druga ma zostać nietknięta.
  writeFileSync(join(project, 'README.md'), '# Projekt testowy\n\nDopisane zdanie.\n');
  writeFileSync(join(project, 'nowy.txt'), 'plik nieśledzony\n');

  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();

  await page.getByTestId('rail-git').click();
  await expect(page.getByTestId('git-panel')).toBeVisible();

  // Liczby wierszy nie sprawdzamy — aplikacja dopisuje do projektu własny
  // konspekt wiedzy (M22), więc lista zmian rośnie w tle.
  const readmeRow = page.locator('.git-change-row', { hasText: 'README.md' });
  const untrackedRow = page.locator('.git-change-row', { hasText: 'nowy.txt' });
  await expect(readmeRow).toBeVisible();
  await expect(untrackedRow).toBeVisible();

  const commitButton = page.getByTestId('git-commit-btn');
  await expect(commitButton).toBeDisabled();

  // Zaznaczenie samego README.md — plik nieśledzony zostaje poza commitem.
  await readmeRow.getByTestId('git-change-check').check();
  await expect(commitButton).toBeDisabled(); // wciąż bez opisu

  await page.getByTestId('git-commit-message').fill('Dopisek w README z panelu');
  await expect(commitButton).toBeEnabled();
  await expect(commitButton).toContainText('1');

  await page.screenshot({ path: 'e2e-artifacts/m69-commit-zaznaczenie.png' });
  await commitButton.click();

  // README znika z listy zmian, nieśledzony plik zostaje.
  await expect(readmeRow).toHaveCount(0);
  await expect(untrackedRow).toBeVisible();
  await expect(page.getByTestId('git-commit-message')).toHaveValue('');

  // Nowy commit widać w historii panelu i w samym repozytorium.
  await expect(page.getByTestId('git-commit').first()).toContainText('Dopisek w README z panelu');
  const subject = execSync('git log -1 --format=%s', { cwd: project, encoding: 'utf8' }).trim();
  expect(subject).toBe('Dopisek w README z panelu');
  const files = execSync('git show --name-only --format= HEAD', {
    cwd: project,
    encoding: 'utf8',
  }).trim();
  expect(files).toBe('README.md');

  await page.screenshot({ path: 'e2e-artifacts/m69-commit-po-zatwierdzeniu.png' });
  await app.close();
});
