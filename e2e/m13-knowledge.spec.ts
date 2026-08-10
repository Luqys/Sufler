import { expect, test } from '@playwright/test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

test('panel Wiedza listuje pliki MD i generuje kontekst agenta', async () => {
  const project = makeFixtureProject();
  mkdirSync(join(project, 'docs'));
  writeFileSync(
    join(project, 'docs', 'przewodnik.md'),
    '# Przewodnik\n\nSekretne-haslo-przewodnika.\n',
  );
  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();

  await page.getByTestId('rail-knowledge').click();
  const panel = page.getByTestId('knowledge-panel');
  await expect(panel).toBeVisible();

  // Lista: README + przewodnik, wszystkie domyślnie zaznaczone.
  const rows = page.getByTestId('knowledge-file');
  await expect(rows).toHaveCount(2);
  await expect(panel).toContainText('README.md');
  await expect(panel).toContainText('przewodnik.md');
  await expect(panel.getByTestId('knowledge-summary')).toContainText('Zaznaczone: 2 z 2');
  await expect(panel.getByTestId('knowledge-generate')).toContainText('(2)');

  // Pliki z korzenia przed katalogami.
  await expect(rows.first()).toContainText('README.md');

  await panel.getByTestId('knowledge-generate').click();
  await expect(page.getByTestId('tab-active')).toContainText('kontekst-agenta.md', {
    timeout: 15_000,
  });
  await expect(panel.getByTestId('knowledge-note')).toBeVisible();

  const generated = readFileSync(join(project, 'kontekst-agenta.md'), 'utf8');
  expect(generated).toContain('# Kontekst wiedzy agenta');
  expect(generated).toContain('# 📄 README.md');
  expect(generated).toContain('# 📄 docs/przewodnik.md');
  expect(generated).toContain('Sekretne-haslo-przewodnika.');

  // Wygenerowany plik nie wraca na listę źródeł.
  await panel.getByTestId('knowledge-refresh').click();
  await expect(rows).toHaveCount(2);

  await page.screenshot({ path: 'e2e-artifacts/m13-panel-wiedzy.png' });
  await app.close();
});

test('pasek pokazuje % zużycia bieżącego okna 5h', async () => {
  const home = mkdtempSync(join(tmpdir(), 'vn3o-home-'));
  const transcripts = join(home, '.claude', 'projects', '-Users-test-projekt');
  mkdirSync(transcripts, { recursive: true });
  const blockMs = 5 * 60 * 60 * 1000;
  const now = Date.now();
  const inCurrentBlock = new Date(Math.floor(now / blockMs) * blockMs + 60_000);
  const oldEntry = new Date(now - 10 * 24 * 60 * 60 * 1000);
  const line = (timestamp: Date, input: number, output: number): string =>
    JSON.stringify({
      type: 'assistant',
      timestamp: timestamp.toISOString(),
      message: { model: 'claude-fable-5', usage: { input_tokens: input, output_tokens: output } },
    });
  writeFileSync(
    join(transcripts, 'sesja.jsonl'),
    `${line(inCurrentBlock, 15, 1200)}\n${line(oldEntry, 30, 2400)}\n`,
  );

  const app = await launchApp(makeConfigHome(), makeFixtureProject(), { HOME: home });
  const page = await app.firstWindow();

  // Pigułka sesji: tokeny bieżącego okna 5h (1215 → „1,2 tys.") + godzina resetu.
  await expect(page.getByTestId('usage-window-tokens')).toContainText('1,2 tys.', {
    timeout: 15_000,
  });
  await expect(page.getByTestId('usage-window-tokens')).toContainText('do ');

  await page.getByTestId('usage-button').click();
  const panel = page.getByTestId('usage-panel');
  await expect(panel).toContainText('Okno 5h');
  await expect(panel).toContainText('reset o');
  // 1215 / 2430 = 50% rekordu z 30 dni.
  await expect(panel).toContainText('50% rekordu');

  await page.screenshot({ path: 'e2e-artifacts/m13-procent-zuzycia.png' });
  await app.close();
});
