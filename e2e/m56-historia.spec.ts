import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

test('historia pracy: commity i sesje na jednej osi czasu, sesja otwiera dziennik', async () => {
  const project = makeFixtureProject();
  mkdirSync(join(project, 'dziennik-sesji'), { recursive: true });
  writeFileSync(
    join(project, 'dziennik-sesji', '2026-08-11-abcdef12.md'),
    `---
kategoria: Dziennik sesji
data: 2026-08-11T09:30:00.000Z
---

# Dziennik sesji — projekt

## 09:30 — polecenie

Dodaj panel historii pracy

- \`09:31\` edycja: \`src/app.ts\`
- \`09:32\` powłoka: \`npm test\`
`,
  );
  const git = (args: string[]): void => {
    execFileSync('git', ['-c', 'user.email=e2e@t', '-c', 'user.name=e2e', ...args], {
      cwd: project,
      stdio: 'ignore',
    });
  };
  writeFileSync(join(project, 'nowy.txt'), 'treść\n');
  git(['add', '-A']);
  git(['commit', '-m', 'Panel historii pracy']);

  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();

  await page.getByTestId('rail-git').click();
  await page.getByTestId('worklog-open').click();

  const view = page.getByTestId('worklog-view');
  await expect(view).toBeVisible();
  await expect(page.getByTestId('tab-active')).toContainText('Historia pracy');

  const commitRow = page.locator('.worklog-row.worklog-commit').filter({
    hasText: 'Panel historii pracy',
  });
  await expect(commitRow).toBeVisible({ timeout: 15_000 });
  await expect(commitRow).toContainText('commit');
  const sessionRow = page.locator('.worklog-row.worklog-session');
  await expect(sessionRow).toBeVisible();
  await expect(sessionRow).toContainText('2 operacji');
  await page.screenshot({ path: 'e2e-artifacts/m56-historia.png' });

  // Klik w sesję otwiera jej dziennik w edytorze.
  await sessionRow.locator('.worklog-link').click();
  await expect(page.getByTestId('tab-active')).toContainText('2026-08-11-abcdef12.md');

  await app.close();
});
