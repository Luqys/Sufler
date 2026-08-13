import { expect, test } from '@playwright/test';
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

test('panel Git pokazuje historię commitów z listą zmienionych plików', async () => {
  const project = makeFixtureProject();
  writeFileSync(join(project, 'nowy.txt'), 'zawartość\n');
  const gitEnv = 'git -c user.email=e2e@vn3o.test -c user.name=e2e';
  execSync(`${gitEnv} add -A`, { cwd: project, stdio: 'ignore' });
  execSync(
    `${gitEnv} commit -q -m "drugi commit" -m "Dłuższy opis zmian: dodano plik nowy.txt z zawartością."`,
    { cwd: project, stdio: 'ignore' },
  );

  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();

  await page.getByTestId('rail-git').click();
  const panel = page.getByTestId('git-panel');
  await expect(panel).toBeVisible();
  await expect(panel.locator('.git-branch')).toBeVisible();

  const commits = page.getByTestId('git-commit');
  await expect(commits).toHaveCount(2);
  await expect(commits.first()).toContainText('drugi commit');
  await expect(commits.nth(1)).toContainText('init');
  await expect(commits.first()).toContainText('e2e');

  // Rozwinięcie commita → pełny opis + zmienione pliki ze statusami.
  await commits.first().locator('.git-row').click();
  await expect(commits.first().getByTestId('git-body')).toContainText('Dłuższy opis zmian');
  await expect(commits.first().locator('.git-file', { hasText: 'nowy.txt' })).toBeVisible();
  await expect(
    commits.first().locator('.git-file', { hasText: 'nowy.txt' }).locator('.git-status-A'),
  ).toBeVisible();

  await commits.nth(1).locator('.git-row').click();
  await expect(commits.nth(1).locator('.git-file', { hasText: 'README.md' })).toBeVisible();

  await page.screenshot({ path: 'e2e-artifacts/m15-historia-git.png' });
  await app.close();
});

test('szybki przełącznik motywu na pasku odwraca jasny/ciemny', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();
  await page.emulateMedia({ colorScheme: null });
  await expect(page.getByTestId('workbench')).toBeVisible();

  const isDark = (): Promise<boolean> =>
    page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const initial = await isDark();

  await page.getByTestId('theme-quick-toggle').click();
  await expect.poll(isDark).toBe(!initial);

  await page.getByTestId('theme-quick-toggle').click();
  await expect.poll(isDark).toBe(initial);

  await app.close();
});

test('przytrzymanie przycisku motywu otwiera wybór koloru przewodniego', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();
  await page.emulateMedia({ colorScheme: null });
  await expect(page.getByTestId('workbench')).toBeVisible();

  const isDark = (): Promise<boolean> =>
    page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches);
  const initialDark = await isDark();

  const button = await page.getByTestId('theme-quick-toggle').boundingBox();
  if (!button) {
    throw new Error('Brak przycisku motywu');
  }
  await page.mouse.move(button.x + button.width / 2, button.y + button.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(750);
  await page.mouse.up();

  const popover = page.getByTestId('accent-popover');
  await expect(popover).toBeVisible();
  // Długie przytrzymanie NIE przełącza motywu.
  expect(await isDark()).toBe(initialDark);

  await page.getByTestId('accent-pick-green').click();
  await expect(popover).toHaveCount(0);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset['accent']))
    .toBe('green');

  await app.close();
});
