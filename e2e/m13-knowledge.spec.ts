import { expect, test } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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

test('pigułka pokazuje prawdziwe limity planu jak w Claude Code', async () => {
  const limitsJson = JSON.stringify({
    five_hour: {
      utilization: 37,
      resets_at: new Date(Date.now() + 3 * 3600 * 1000).toISOString(),
    },
    seven_day: {
      utilization: 12,
      resets_at: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
    },
    limits: [
      { kind: 'session', percent: 37, severity: 'warning', is_active: true },
      { kind: 'weekly_all', percent: 12, severity: 'normal', is_active: false },
    ],
  });
  const app = await launchApp(makeConfigHome(), makeFixtureProject(), {
    VISUALN3O_LIMITS_JSON: limitsJson,
  });
  const page = await app.firstWindow();

  const pill = page.getByTestId('usage-limits-text');
  await expect(pill).toContainText('37%', { timeout: 15_000 });
  await expect(pill).toContainText('tydz. 12%');

  await page.getByTestId('usage-button').click();
  const panel = page.getByTestId('usage-panel');
  await expect(panel).toContainText('Limity planu Claude');
  const section = page.getByTestId('usage-limits-section');
  await expect(page.getByTestId('limit-session')).toContainText('37%');
  await expect(page.getByTestId('limit-weekly')).toContainText('12%');
  await expect(section).toContainText('reset');
  // Panel pokazuje wyłącznie realne limity — bez lokalnych szacunków z transkryptów.
  await expect(panel).not.toContainText('Okno 5h');
  await expect(panel).not.toContainText('transkryptów');

  await page.screenshot({ path: 'e2e-artifacts/m16-limity-planu.png' });
  await app.close();
});
