import { expect, test } from '@playwright/test';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

test('graf aktualizuje się po dodaniu notatki, konspekt wiedzy powstaje sam', async () => {
  const project = makeFixtureProject();
  writeFileSync(join(project, 'notatka-a.md'), '# Notatka A\n\nZobacz [[notatka-b]].\n');
  writeFileSync(join(project, 'notatka-b.md'), '# Notatka B\n\n## Sekcja B\n');

  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();

  await page.getByTestId('rail-knowledge').click();
  // README + 2 notatki (konspekt-wiedzy.md jest wykluczony ze źródeł).
  await expect(page.getByTestId('graph-stats')).toContainText('3 notatki', { timeout: 15_000 });

  // Konspekt generuje się automatycznie od wejścia do projektu.
  const outlinePath = join(project, 'konspekt-wiedzy.md');
  await expect.poll(() => existsSync(outlinePath), { timeout: 15_000 }).toBe(true);
  const outline = readFileSync(outlinePath, 'utf8');
  expect(outline).toContain('# Konspekt wiedzy');
  expect(outline).toContain('## 📄 notatka-a.md');
  expect(outline).toContain('  - Sekcja B');
  expect(outline).toContain('Powiązania: notatka-b');

  // Nowy plik .md → graf przelicza się sam, konspekt też.
  writeFileSync(join(project, 'notatka-c.md'), '# Notatka C\n');
  await expect(page.getByTestId('graph-stats')).toContainText('4 notatki', { timeout: 15_000 });
  await expect
    .poll(() => readFileSync(outlinePath, 'utf8').includes('notatka-c.md'), { timeout: 15_000 })
    .toBe(true);

  await page.screenshot({ path: 'e2e-artifacts/m22-graf-live.png' });
  await app.close();
});
