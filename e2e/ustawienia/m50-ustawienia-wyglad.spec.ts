import { expect, test } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

test('Ustawienia: segmentowane przełączniki, pełny opis i zrzuty w trzech motywach', async () => {
  const app = await launchApp(makeConfigHome(), makeFixtureProject());
  const page = await app.firstWindow();

  await page.getByTestId('settings-button').click();
  const view = page.getByTestId('settings-view');
  await expect(view).toBeVisible();

  // Podtytuł i opisy sekcji zamiast gołych nagłówków.
  await expect(view).toContainText('zmiany zapisują się od razu');
  await expect(view).toContainText('Dziennik sesji');

  // Ostatnia podpowiedź jest w całości widoczna (nie ucięta wielokropkiem).
  const hint = view.locator('.settings-hint').last();
  await expect(hint).toContainText('settings.local.json');
  const clipped = await hint.evaluate(
    (element) => element.scrollWidth > element.clientWidth + 1,
  );
  expect(clipped).toBe(false);

  // Motyw i język to segmentowane przełączniki z zaznaczonym stanem.
  await expect(view.getByTestId('theme-system')).toHaveClass(/segmented-btn/);
  await expect(view.getByTestId('language-pl')).toHaveClass(/active/);

  await page.screenshot({ path: 'e2e-artifacts/m50-ustawienia-jasny.png' });
  await view.getByTestId('theme-dark').click();
  await expect(view.getByTestId('theme-dark')).toHaveClass(/active/);
  await page.screenshot({ path: 'e2e-artifacts/m50-ustawienia-ciemny.png' });
  await view.getByTestId('theme-matrix').click();
  await page.screenshot({ path: 'e2e-artifacts/m50-ustawienia-matrix.png' });

  await app.close();
});

test('pasek grafu: tryby w jednym rzędzie, legenda tylko z grupami', async () => {
  // Graf z połączeniami — nakładka na pustym płótnie niczego nie dowodzi.
  const project = makeFixtureProject();
  writeFileSync(
    join(project, 'architektura.md'),
    '---\ntagi: [projekt, backend]\n---\n\n# Architektura\n\nOpisuje [[model-danych]] i [[uprawnienia]].\n',
  );
  writeFileSync(
    join(project, 'model-danych.md'),
    '---\ntagi: backend\n---\n\n# Model danych\n\nTabele SQL, wraca do [[architektura]].\n',
  );
  writeFileSync(
    join(project, 'uprawnienia.md'),
    '# Uprawnienia\n\nLogowanie i role; zobacz [[model-danych]].\n',
  );
  writeFileSync(join(project, 'realtime.md'), '# Realtime\n\nKanały zdarzeń — [[architektura]].\n');

  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();

  await page.getByTestId('rail-knowledge').click();
  await expect(page.getByTestId('graph-stats')).toContainText('5 notatek', { timeout: 15_000 });
  await expect(page.getByTestId('graph-stats')).toContainText('4 połączenia');

  /*
   * Od M105 tryby siedzą w pasku nad płótnem, a nie w karcie legendy. Pięć
   * przycisków stoi w jednym rzędzie (te same współrzędne Y), a pasek niczego
   * nie ucina — wcześniej „Przelicz" wyjeżdżał poza krawędź.
   */
  const bar = page.getByTestId('graph-bar');
  await expect(bar).toBeVisible();
  const tryby = ['graph-mode-author', 'graph-mode-tags', 'graph-mode-fresh'];
  const gorne = await Promise.all(
    tryby.map(async (id) => Math.round((await page.getByTestId(id).boundingBox())!.y)),
  );
  expect(new Set(gorne).size).toBe(1);
  const przyciete = await bar.evaluate(
    (element) => element.scrollWidth > element.clientWidth + 1,
  );
  expect(przyciete).toBe(false);

  // Karta legendy niesie już tylko grupy — bez przełącznika trybów.
  const legend = page.getByTestId('graph-legend');
  await expect(legend.getByTestId('graph-mode-tags')).toHaveCount(0);

  const orphans = page.getByTestId('graph-orphans');
  await orphans.click();
  await expect(orphans).toHaveClass(/graph-orphans-on/);
  await page.screenshot({ path: 'e2e-artifacts/m50-graf-nakladka.png' });

  await app.close();
});
