import { expect, test } from '@playwright/test';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

/** Dwa skille projektu — jeden do skasowania, drugi na dowód, że reszta zostaje. */
function addSkills(project: string): void {
  for (const [name, opis] of [
    ['deploy-prod', 'Wdrożenie na produkcję'],
    ['audyt-bezpieczenstwa', 'Przegląd bezpieczeństwa zmian'],
  ]) {
    const dir = join(project, '.claude', 'skills', name!);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: ${opis}\n---\n\nTreść.\n`);
    // Plik obok SKILL.md — usunięcie ma zabrać cały katalog skilla.
    writeFileSync(join(dir, 'notatki.md'), 'szczegóły\n');
  }
}

test('M103: kosz usuwa katalog skilla po potwierdzeniu, anulowanie nic nie rusza', async () => {
  const project = makeFixtureProject();
  addSkills(project);
  const app = await launchApp(makeConfigHome(), project, {
    HOME: mkdtempSync(join(tmpdir(), 'vn3o-home-')),
  });
  const page = await app.firstWindow();

  await page.getByTestId('rail-skills').click();
  const panel = page.getByTestId('skills-panel');
  await expect(panel.getByText('deploy-prod')).toBeVisible();

  // Pasek akcji: trzy równe pola zamiast przycisku i dwóch nagich ikon.
  await expect(page.getByTestId('skills-new')).toBeVisible();
  await expect(page.getByTestId('agents-new')).toContainText('+ Agent');
  await expect(page.getByTestId('rules-new')).toContainText('+ Reguła');
  await page.screenshot({ path: 'e2e-artifacts/m103-pasek-skilli.png' });

  const skillDir = join(project, '.claude', 'skills', 'deploy-prod');
  const kosz = page.getByTestId('skill-delete-deploy-prod');

  // Anulowanie zostawia skill na dysku.
  await kosz.click();
  await expect(page.getByTestId('confirm-dialog')).toContainText('deploy-prod');
  await page.getByTestId('confirm-cancel').click();
  expect(existsSync(join(skillDir, 'SKILL.md'))).toBe(true);

  // Potwierdzenie kasuje cały katalog skilla, drugi skill zostaje.
  await kosz.click();
  await page.screenshot({ path: 'e2e-artifacts/m103-pytanie-o-usuniecie.png' });
  await page.getByTestId('confirm-accept').click();
  await expect(panel.getByText('deploy-prod')).toHaveCount(0, { timeout: 15_000 });
  await expect.poll(() => existsSync(skillDir)).toBe(false);
  await expect(panel.getByText('audyt-bezpieczenstwa')).toBeVisible();

  await app.close();
});
