import { expect, test } from '@playwright/test';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

test('graf aktualizuje się po dodaniu notatki, a aplikacja nie zostawia plików w projekcie', async () => {
  const project = makeFixtureProject();
  writeFileSync(join(project, 'notatka-a.md'), '# Notatka A\n\nZobacz [[notatka-b]].\n');
  writeFileSync(join(project, 'notatka-b.md'), '# Notatka B\n\n## Sekcja B\n');

  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();

  await page.getByTestId('rail-knowledge').click();
  // README + 2 notatki.
  await expect(page.getByTestId('graph-stats')).toContainText('3 notatki', { timeout: 15_000 });

  /*
   * M96: aplikacja NIE zapisuje już konspektu w projekcie. Konspekt dla Claude
   * liczy się na żądanie w narzędziu MCP, więc katalog użytkownika zostaje
   * dokładnie taki, jaki był.
   */
  const outlinePath = join(project, 'konspekt-wiedzy.md');
  expect(existsSync(outlinePath)).toBe(false);

  // Nowy plik .md → graf przelicza się sam…
  writeFileSync(join(project, 'notatka-c.md'), '# Notatka C\n');
  await expect(page.getByTestId('graph-stats')).toContainText('4 notatki', { timeout: 15_000 });
  // …i nadal żaden plik roboczy nie ląduje w projekcie.
  expect(existsSync(outlinePath)).toBe(false);

  await page.screenshot({ path: 'e2e-artifacts/m22-graf-live.png' });
  await app.close();
});
