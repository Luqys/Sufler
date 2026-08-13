import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

test('karty Ustawień i Samouczka w edytorze; skille: zielone tło i karta z nazwą', async () => {
  const project = makeFixtureProject();
  const dir = join(project, '.claude', 'skills', 'moj-skill');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'SKILL.md'), '---\nname: moj-skill\ndescription: Opis testowy\n---\n');

  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();

  // Zębatka i ? otwierają karty w środkowym obszarze (nie modale).
  await page.getByTestId('settings-button').click();
  await expect(page.getByTestId('settings-view')).toBeVisible();
  await expect(page.getByTestId('settings-view')).not.toContainText('Vault Obsidiana');
  await page.getByTestId('help-button').click();
  await expect(page.getByTestId('help-view')).toBeVisible();
  await expect(page.getByTestId('tab-active')).toContainText('Samouczek');

  // Włączony skill: zielone tło zamiast plakietki; klik = karta z nazwą skilla.
  await page.getByTestId('rail-skills').click();
  const row = page.locator('.skill-item-on').filter({ hasText: 'moj-skill' });
  await expect(row).toBeVisible();
  await expect(row).not.toContainText('wyłączony');
  await row.locator('.skill-row').click();
  await expect(page.getByTestId('tab-active')).toContainText('moj-skill');

  await page.screenshot({ path: 'e2e-artifacts/m47-karty.png' });
  await app.close();
});
