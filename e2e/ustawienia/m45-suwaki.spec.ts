import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

test('panel skilli przewija długą listę smukłym suwakiem', async () => {
  const project = makeFixtureProject();
  for (let index = 1; index <= 30; index += 1) {
    const name = `skill-${String(index).padStart(2, '0')}`;
    const dir = join(project, '.claude', 'skills', name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, 'SKILL.md'),
      `---\nname: ${name}\ndescription: Opis testowy ${index}\n---\n`,
    );
  }

  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();

  await page.getByTestId('rail-skills').click();
  const panel = page.getByTestId('skills-panel');
  await expect(panel.getByText('skill-01')).toBeVisible();

  // Kontener przewijania aktywnego widoku (jedyny nieschowany .scroll).
  const view = page.locator('.view-panel.scroll:not(.hidden)');
  await view.hover();
  await page.mouse.wheel(0, 600);
  await expect
    .poll(() => view.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(0);

  await page.screenshot({ path: 'e2e-artifacts/m45-suwaki.png' });
  await app.close();
});
