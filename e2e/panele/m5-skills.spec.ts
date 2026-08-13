import { expect, test } from '@playwright/test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFakeClaudeBin, makeFixtureProject } from '../utils';

function addSkillsFixture(project: string): void {
  const skillDir = join(project, '.claude', 'skills', 'deploy-prod');
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(
    join(skillDir, 'SKILL.md'),
    '---\nname: deploy-prod\ndescription: Wdrożenie na produkcję\ndisable-model-invocation: true\n---\n\nInstrukcje wdrożenia.\n',
  );
  const agentsDir = join(project, '.claude', 'agents');
  mkdirSync(agentsDir, { recursive: true });
  writeFileSync(
    join(agentsDir, 'reviewer.md'),
    '---\nname: reviewer\ndescription: Recenzent kodu\ntools: Read, Grep\nmodel: haiku\n---\n',
  );
  const rulesDir = join(project, '.claude', 'rules');
  mkdirSync(rulesDir, { recursive: true });
  writeFileSync(join(rulesDir, 'api.md'), '---\npaths: src/api/**\n---\nReguły API.\n');
  writeFileSync(join(project, 'CLAUDE.md'), 'linia pierwsza\nlinia druga\nlinia trzecia\n');
}

test('panel skilli pokazuje grupy z frontmattera i otwiera pliki', async () => {
  const project = makeFixtureProject();
  addSkillsFixture(project);
  const app = await launchApp(makeConfigHome(), project, {
    HOME: mkdtempSync(join(tmpdir(), 'vn3o-home-')),
    VISUALN3O_PATH_PREPEND: makeFakeClaudeBin(),
  });
  const page = await app.firstWindow();

  await page.getByTestId('rail-skills').click();
  const panel = page.getByTestId('skills-panel');
  await expect(panel).toBeVisible();

  await expect(panel.getByText('deploy-prod')).toBeVisible();
  await expect(panel.getByText('Wdrożenie na produkcję')).toBeVisible();
  await expect(panel.getByText('manual')).toBeVisible();
  await expect(panel.getByText('reviewer')).toBeVisible();
  await expect(panel.getByText('Recenzent kodu')).toBeVisible();
  await expect(panel.getByText('haiku')).toBeVisible();
  await expect(panel.getByText('api', { exact: true })).toBeVisible();
  await expect(panel.getByText('paths')).toBeVisible();
  await expect(panel.getByText('CLAUDE.md (projekt)')).toBeVisible();
  await expect(panel.getByText('3 linie')).toBeVisible();

  // Kliknięcie otwiera plik w edytorze.
  await panel.getByText('deploy-prod').click();
  await expect(page.getByTestId('tab-active')).toContainText('deploy-prod');

  // Cmd+klik wstawia /nazwę do aktywnej sesji Claude.
  await page.getByTestId('bottom-new-claude').click();
  await expect(page.locator('[data-testid=bottom-dock] .xterm')).toContainText('atrapa', {
    timeout: 15_000,
  });
  await panel.getByText('deploy-prod').click({ modifiers: ['Meta'] });
  await expect(page.locator('[data-testid=bottom-dock] .xterm')).toContainText('/deploy-prod', {
    timeout: 10_000,
  });

  await page.screenshot({ path: 'e2e-artifacts/m5-panel-skilli.png' });
  await app.close();
});

test('nowy skill pojawia się bez restartu (chokidar)', async () => {
  const project = makeFixtureProject();
  addSkillsFixture(project);
  const app = await launchApp(makeConfigHome(), project, {
    HOME: mkdtempSync(join(tmpdir(), 'vn3o-home-')),
  });
  const page = await app.firstWindow();

  await page.getByTestId('rail-skills').click();
  const panel = page.getByTestId('skills-panel');
  await expect(panel.getByText('deploy-prod')).toBeVisible();

  const newSkillDir = join(project, '.claude', 'skills', 'nowy-skill');
  mkdirSync(newSkillDir, { recursive: true });
  writeFileSync(
    join(newSkillDir, 'SKILL.md'),
    '---\nname: nowy-skill\ndescription: Dodany w locie\n---\n',
  );

  await expect(panel.getByText('nowy-skill')).toBeVisible({ timeout: 10_000 });
  await expect(panel.getByText('Dodany w locie')).toBeVisible();

  await app.close();
});
