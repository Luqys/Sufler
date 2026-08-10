import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

test('graf wiedzy: kolorowanie po funkcji programu i warstwie, filtr legendy', async () => {
  const project = makeFixtureProject();
  writeFileSync(
    join(project, 'ekran-logowania.md'),
    '# Ekran logowania\n\nKomponent React, styl przycisku w CSS.\n',
  );
  writeFileSync(
    join(project, 'serwer-api.md'),
    '# Serwer API\n\nEndpoint REST zapisuje do bazy danych (SQL).\n',
  );
  writeFileSync(
    join(project, 'platnosci.md'),
    '---\nkategoria: Płatności\nwarstwa: backend\n---\n\n# Płatności\n\n' +
      'Frontmatter nadaje kategorie ręcznie. Zobacz [[ekran-logowania]] i [[serwer-api]].\n',
  );

  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();

  await page.getByTestId('rail-knowledge').click();
  await expect(page.getByTestId('graph-stats')).toContainText('4 notatki', { timeout: 15_000 });
  await expect(page.getByTestId('graph-stats')).toContainText('2 połączenia');

  // Domyślnie kolor według autora ostatniej zmiany.
  const legend = page.getByTestId('graph-legend');
  await expect(legend).toContainText('Ostatnia zmiana');

  // Tryb „Funkcja": heurystyka treści + kategoria z frontmattera.
  await page.getByTestId('graph-mode-category').click();
  await expect(legend).toContainText('Funkcja programu');
  await expect(legend).toContainText('Interfejs');
  await expect(legend).toContainText('API');
  await expect(legend).toContainText('Płatności');

  // Tryb „Warstwa": frontend/backend z heurystyki i frontmattera.
  await page.getByTestId('graph-mode-layer').click();
  await expect(legend).toContainText('Frontend');
  await expect(legend).toContainText('Backend');

  // Klik w wiersz legendy zawęża graf do grupy (wiersz dostaje stan aktywny).
  const backendRow = legend.getByTestId('graph-legend-row').filter({ hasText: /^Backend/ });
  await backendRow.click();
  await expect(backendRow).toHaveClass(/active/);

  await page.screenshot({ path: 'e2e-artifacts/m23-graf-kategorie.png' });
  await app.close();
});
