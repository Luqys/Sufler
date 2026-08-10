import { expect, test } from '@playwright/test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

function addAgentFixture(project: string): void {
  const dir = join(project, '.claude', 'agents');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'recenzent.md'),
    '---\nname: recenzent\ndescription: Recenzja kodu przed commitem\n---\n\nInstrukcje recenzji.\n',
  );
}

interface LocalSettings {
  permissions?: { allow?: string[]; deny?: string[] };
}

function readLocalSettings(project: string): LocalSettings {
  const path = join(project, '.claude', 'settings.local.json');
  if (!existsSync(path)) {
    return {};
  }
  return JSON.parse(readFileSync(path, 'utf8')) as LocalSettings;
}

test('przełącznik agenta zapisuje regułę Agent(…) w permissions.deny', async () => {
  const project = makeFixtureProject();
  addAgentFixture(project);
  // Istniejący settings.local.json — przełącznik ma dopisywać, nie nadpisywać.
  mkdirSync(join(project, '.claude'), { recursive: true });
  writeFileSync(
    join(project, '.claude', 'settings.local.json'),
    `${JSON.stringify({ permissions: { allow: ['Bash(ls:*)'] } }, null, 2)}\n`,
  );
  const app = await launchApp(makeConfigHome(), project, {
    HOME: mkdtempSync(join(tmpdir(), 'vn3o-home-')),
  });
  const page = await app.firstWindow();

  await page.getByTestId('rail-skills').click();
  const panel = page.getByTestId('skills-panel');
  await expect(panel.getByText('recenzent')).toBeVisible();

  const toggle = page.getByTestId('agent-toggle-recenzent');
  await expect(toggle).toBeChecked();

  // Wyłączenie: reguła deny w settings.local.json + wyszarzony wiersz z plakietką.
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await expect
    .poll(() => readLocalSettings(project).permissions?.deny ?? [])
    .toContain('Agent(recenzent)');
  expect(readLocalSettings(project).permissions?.allow).toEqual(['Bash(ls:*)']);
  await expect(panel.getByText('wyłączony')).toBeVisible();
  await page.screenshot({ path: 'e2e-artifacts/m32-agent-off.png' });

  // Ponowne włączenie usuwa regułę.
  await toggle.click();
  await expect(toggle).toBeChecked();
  await expect
    .poll(() => (readLocalSettings(project).permissions?.deny ?? []).includes('Agent(recenzent)'))
    .toBe(false);

  await app.close();
});

test('deny w settings.json projektu blokuje lokalny przełącznik', async () => {
  const project = makeFixtureProject();
  addAgentFixture(project);
  writeFileSync(
    join(project, '.claude', 'settings.json'),
    `${JSON.stringify({ permissions: { deny: ['Agent(recenzent)'] } }, null, 2)}\n`,
  );
  const app = await launchApp(makeConfigHome(), project, {
    HOME: mkdtempSync(join(tmpdir(), 'vn3o-home-')),
  });
  const page = await app.firstWindow();

  await page.getByTestId('rail-skills').click();
  const panel = page.getByTestId('skills-panel');
  const toggle = page.getByTestId('agent-toggle-recenzent');
  await expect(toggle).not.toBeChecked();
  await expect(toggle).toBeDisabled();
  await expect(panel.getByText('wyłączony')).toBeVisible();
  await page.screenshot({ path: 'e2e-artifacts/m32-agent-zablokowany.png' });

  await app.close();
});
