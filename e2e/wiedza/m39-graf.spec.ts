import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

test('graf wiedzy: tryby tagów i świeżości, szukajka, ukrywanie osieroconych', async () => {
  const project = makeFixtureProject();
  writeFileSync(
    join(project, 'alfa.md'),
    '---\ntagi: [projekt, backend]\n---\n\n# Alfa\n\nZobacz [[beta]] i jeszcze raz [[beta]].\n',
  );
  writeFileSync(
    join(project, 'beta.md'),
    '---\ntagi: projekt\n---\n\n# Beta\n\nWraca do [[alfa]].\n',
  );
  writeFileSync(join(project, 'gamma.md'), '# Gamma\n\nSamotna notatka bez linków.\n');

  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();

  await page.getByTestId('rail-knowledge').click();
  const stats = page.getByTestId('graph-stats');
  await expect(stats).toContainText('4 notatki', { timeout: 15_000 });
  await expect(stats).toContainText('1 połączenie');

  // Tryb „Tagi": grupy z frontmattera + „(bez tagów)"; filtr po tagu.
  const legend = page.getByTestId('graph-legend');
  await page.getByTestId('graph-mode-tags').click();
  await expect(legend).toContainText('Tagi notatek');
  await expect(legend).toContainText('projekt');
  await expect(legend).toContainText('backend');
  await expect(legend).toContainText('(bez tagów)');
  const projektRow = legend.getByTestId('graph-legend-row').filter({ hasText: /^projekt/ });
  await projektRow.click();
  await expect(projektRow).toHaveClass(/active/);
  await projektRow.click();

  // Tryb „Świeżość": README z commita fixture = Dziś, reszta niezacommitowana.
  await page.getByTestId('graph-mode-fresh').click();
  await expect(legend).toContainText('Ostatnia aktywność');
  await expect(legend).toContainText('Dziś');
  await expect(legend).toContainText('(niezacommitowane)');

  // Szukajka: licznik trafień, Enter otwiera szczegóły pierwszego trafienia.
  await page.getByTestId('graph-search').fill('beta');
  await expect(stats).toContainText('1 trafienie');
  await page.getByTestId('graph-search').press('Enter');
  await expect(page.getByTestId('graph-details')).toContainText('beta');
  await page.screenshot({ path: 'e2e-artifacts/m39-graf-tagi.png' });
  await page.getByTestId('graph-search').fill('');

  // Ukrycie osieroconych: gamma i README znikają ze statystyk i wracają.
  await page.getByTestId('graph-orphans').click();
  await expect(stats).toContainText('2 notatki');
  await page.getByTestId('graph-orphans').click();
  await expect(stats).toContainText('4 notatki');

  await app.close();
});
