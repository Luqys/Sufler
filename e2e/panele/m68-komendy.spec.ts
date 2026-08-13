import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

test('M68: slash-komendy projektu w panelu, nowa pojawia się bez restartu', async () => {
  const project = makeFixtureProject();
  const commandsDir = join(project, '.claude', 'commands');
  mkdirSync(join(commandsDir, 'frontend'), { recursive: true });
  writeFileSync(
    join(commandsDir, 'wydanie.md'),
    '---\ndescription: Buduje paczkę i publikuje\nargument-hint: "<wersja>"\n---\n\nZrób wydanie.\n',
  );
  writeFileSync(join(commandsDir, 'frontend', 'build.md'), 'Zbuduj front.\n');

  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();

  await page.getByTestId('rail-skills').click();
  await expect(page.getByTestId('skills-panel')).toBeVisible();

  // Grupa komend: nazwa z ukośnikiem, opis i podpowiedź argumentów z frontmattera.
  const release = page.locator('.skill-row', { hasText: '/wydanie' });
  await expect(release).toBeVisible();
  await expect(release).toContainText('Buduje paczkę i publikuje');
  await expect(release).toContainText('<wersja>');

  // Podkatalog tworzy przestrzeń nazw.
  await expect(page.locator('.skill-row', { hasText: '/frontend:build' })).toBeVisible();

  // Zrzut ma pokazywać grupę komend, a nie początek listy skilli osobistych.
  await release.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'e2e-artifacts/m68-komendy.png' });

  // Nowy plik w commands/ ma się pojawić bez restartu (chokidar).
  writeFileSync(
    join(commandsDir, 'przeglad.md'),
    '---\ndescription: Przegląd zmian na gałęzi\n---\n\nZrób przegląd.\n',
  );
  const added = page.locator('.skill-row', { hasText: '/przeglad' });
  await expect(added).toBeVisible({ timeout: 15_000 });
  await expect(added).toContainText('Przegląd zmian na gałęzi');

  await added.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'e2e-artifacts/m68-komendy-bez-restartu.png' });
  await app.close();
});
