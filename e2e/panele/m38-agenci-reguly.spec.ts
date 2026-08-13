import { expect, test } from '@playwright/test';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

test('kreator subagenta waliduje nazwę i zapisuje .claude/agents/<nazwa>.md', async () => {
  const project = makeFixtureProject();
  const app = await launchApp(makeConfigHome(), project, {
    HOME: mkdtempSync(join(tmpdir(), 'vn3o-home-')),
  });
  const page = await app.firstWindow();

  await page.getByTestId('rail-skills').click();
  await page.getByTestId('agents-new').click();
  const dialog = page.getByTestId('agent-create-dialog');
  await expect(dialog).toBeVisible();

  // Zła nazwa → komunikat walidacji, dialog zostaje.
  await dialog.getByTestId('agent-create-name').fill('Zły Agent');
  await dialog.getByTestId('agent-create-desc').fill('Recenzje endpointów API');
  await dialog.getByTestId('agent-create-submit').click();
  await expect(dialog.getByTestId('agent-create-error')).toContainText('kebab-case');

  // Poprawne dane (z narzędziami i modelem) → plik na dysku, wpis, zakładka.
  await dialog.getByTestId('agent-create-name').fill('recenzent-api');
  await dialog.getByTestId('agent-create-tools').fill('Read, Grep');
  await dialog.getByTestId('agent-create-model').selectOption('haiku');
  await dialog.getByTestId('agent-create-submit').click();
  await expect(dialog).not.toBeVisible();

  const agentPath = join(project, '.claude', 'agents', 'recenzent-api.md');
  await expect.poll(() => existsSync(agentPath)).toBe(true);
  const content = readFileSync(agentPath, 'utf8');
  expect(content).toContain('name: recenzent-api');
  expect(content).toContain('description: Recenzje endpointów API');
  expect(content).toContain('tools: Read, Grep');
  expect(content).toContain('model: haiku');

  const panel = page.getByTestId('skills-panel');
  await expect(panel.getByText('recenzent-api')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('agent-toggle-recenzent-api')).toBeChecked();
  await expect(page.getByTestId('tab-active')).toContainText('recenzent-api.md');

  await page.screenshot({ path: 'e2e-artifacts/m38-kreator-agenta.png' });
  await app.close();
});

test('kreator reguły zapisuje .claude/rules/<nazwa>.md z listą globów', async () => {
  const project = makeFixtureProject();
  const app = await launchApp(makeConfigHome(), project, {
    HOME: mkdtempSync(join(tmpdir(), 'vn3o-home-')),
  });
  const page = await app.firstWindow();

  await page.getByTestId('rail-skills').click();
  await page.getByTestId('rules-new').click();
  const dialog = page.getByTestId('rule-create-dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByTestId('rule-create-name').fill('konwencje-testow');
  await dialog.getByTestId('rule-create-paths').fill('tests/**/*.ts, e2e/**');
  await dialog.getByTestId('rule-create-body').fill('- Nazwy testów opisowe.\n');
  await dialog.getByTestId('rule-create-submit').click();
  await expect(dialog).not.toBeVisible();

  const rulePath = join(project, '.claude', 'rules', 'konwencje-testow.md');
  await expect.poll(() => existsSync(rulePath)).toBe(true);
  const content = readFileSync(rulePath, 'utf8');
  expect(content).toContain('paths:\n  - tests/**/*.ts\n  - e2e/**');
  expect(content).toContain('- Nazwy testów opisowe.');

  const panel = page.getByTestId('skills-panel');
  await expect(panel.getByText('konwencje-testow')).toBeVisible({ timeout: 10_000 });
  await expect(panel.getByText('paths', { exact: true })).toBeVisible();
  await expect(page.getByTestId('tab-active')).toContainText('konwencje-testow.md');

  await page.screenshot({ path: 'e2e-artifacts/m38-kreator-reguly.png' });
  await app.close();
});
