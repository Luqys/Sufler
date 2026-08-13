import { expect, test } from '@playwright/test';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

function commitAs(project: string, author: string, message: string): void {
  execSync(
    `git -c user.email=${author.toLowerCase()}@vn3o.test -c user.name=${author} add -A`,
    { cwd: project, stdio: 'ignore' },
  );
  execSync(
    `git -c user.email=${author.toLowerCase()}@vn3o.test -c user.name=${author} commit -q -m "${message}"`,
    { cwd: project, stdio: 'ignore' },
  );
}

test('graf wiedzy: notatki, linki i autorzy ostatnich zmian', async () => {
  const project = makeFixtureProject();
  const notes = join(project, 'notatki');
  mkdirSync(notes);
  writeFileSync(
    join(notes, 'Architektura.md'),
    '# Architektura\n\nŁączy [[Baza danych]] oraz [[api]].\n',
  );
  writeFileSync(join(notes, 'Baza danych.md'), '# Baza danych\n\nWraca do [[Architektura]].\n');
  writeFileSync(join(notes, 'api.md'), '# API\n');
  commitAs(project, 'Anna', 'notatki wiedzy');
  writeFileSync(join(notes, 'api.md'), '# API\n\nZaktualizowane przez drugiego autora.\n');
  commitAs(project, 'Bartek', 'aktualizacja api');

  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();

  // Klik w „Wiedzę" na pasku ikon od razu otwiera graf.
  await page.getByTestId('rail-knowledge').click();

  await expect(page.getByTestId('tab-active')).toContainText('Graf wiedzy');
  await expect(page.getByTestId('graph-view')).toBeVisible();

  // 4 notatki (README + 3 w notatki/), 2 krawędzie (arch↔baza, arch→api).
  await expect(page.getByTestId('graph-stats')).toContainText('4 notatki', { timeout: 15_000 });
  await expect(page.getByTestId('graph-stats')).toContainText('2 połączenia');

  // Legenda autorów ostatnich zmian.
  const legend = page.getByTestId('graph-legend');
  await expect(legend).toContainText('Anna');
  await expect(legend).toContainText('Bartek');

  await page.screenshot({ path: 'e2e-artifacts/m18-graf-wiedzy.png' });
  await app.close();
});
