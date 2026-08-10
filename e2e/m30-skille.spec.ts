import { expect, test } from '@playwright/test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

function addSkillFixture(project: string): void {
  const skillDir = join(project, '.claude', 'skills', 'deploy-prod');
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    join(skillDir, 'SKILL.md'),
    '---\nname: deploy-prod\ndescription: Wdrożenie na produkcję\n---\n\nInstrukcje wdrożenia.\n',
  );
}

function readLocalSettings(project: string): { skillOverrides?: Record<string, string> } {
  const path = join(project, '.claude', 'settings.local.json');
  if (!existsSync(path)) {
    return {};
  }
  return JSON.parse(readFileSync(path, 'utf8')) as { skillOverrides?: Record<string, string> };
}

test('przełącznik zapisuje skillOverrides w settings.local.json', async () => {
  const project = makeFixtureProject();
  addSkillFixture(project);
  const app = await launchApp(makeConfigHome(), project, {
    HOME: mkdtempSync(join(tmpdir(), 'vn3o-home-')),
  });
  const page = await app.firstWindow();

  await page.getByTestId('rail-skills').click();
  const panel = page.getByTestId('skills-panel');
  await expect(panel.getByText('deploy-prod')).toBeVisible();

  const toggle = page.getByTestId('skill-toggle-deploy-prod');
  await expect(toggle).toBeChecked();

  // Wyłączenie: off w settings.local.json + wyszarzony wiersz z plakietką.
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await expect
    .poll(() => readLocalSettings(project).skillOverrides?.['deploy-prod'] ?? '(brak)')
    .toBe('off');
  await expect(panel.locator('.skill-item-off').filter({ hasText: 'deploy-prod' })).toBeVisible();
  await page.screenshot({ path: 'e2e-artifacts/m30-przelacznik-off.png' });

  // Ponowne włączenie sprząta wpis (wraca domyślne "on").
  await toggle.click();
  await expect(toggle).toBeChecked();
  await expect
    .poll(() => readLocalSettings(project).skillOverrides?.['deploy-prod'] ?? '(brak)')
    .toBe('(brak)');

  await app.close();
});

test('kreator waliduje nazwę, tworzy SKILL.md i otwiera go w edytorze', async () => {
  const project = makeFixtureProject();
  addSkillFixture(project);
  const app = await launchApp(makeConfigHome(), project, {
    HOME: mkdtempSync(join(tmpdir(), 'vn3o-home-')),
  });
  const page = await app.firstWindow();

  await page.getByTestId('rail-skills').click();
  await page.getByTestId('skills-new').click();
  const dialog = page.getByTestId('skill-create-dialog');
  await expect(dialog).toBeVisible();

  // Zła nazwa → komunikat walidacji, dialog zostaje.
  await dialog.getByTestId('skill-create-name').fill('Złe Imię');
  await dialog.getByTestId('skill-create-desc').fill('Generowanie changelog z historii git');
  await dialog.getByTestId('skill-create-submit').click();
  await expect(dialog.getByTestId('skill-create-error')).toContainText('kebab-case');

  // Poprawna nazwa → plik na dysku, wpis w panelu, zakładka edytora.
  await dialog.getByTestId('skill-create-name').fill('generator-changelog');
  await dialog.getByTestId('skill-create-submit').click();
  await expect(dialog).not.toBeVisible();

  const skillPath = join(project, '.claude', 'skills', 'generator-changelog', 'SKILL.md');
  await expect.poll(() => existsSync(skillPath)).toBe(true);
  const content = readFileSync(skillPath, 'utf8');
  expect(content).toContain('name: generator-changelog');
  expect(content).toContain('description: Generowanie changelog z historii git');

  const panel = page.getByTestId('skills-panel');
  await expect(panel.getByText('generator-changelog')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('tab-active')).toContainText('generator-changelog');

  await page.screenshot({ path: 'e2e-artifacts/m30-kreator-skilli.png' });
  await app.close();
});
