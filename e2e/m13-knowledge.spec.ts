import { expect, test } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

test('panel Wiedza listuje pliki MD projektu', async () => {
  const project = makeFixtureProject();
  mkdirSync(join(project, 'docs'));
  writeFileSync(
    join(project, 'docs', 'przewodnik.md'),
    '# Przewodnik\n\nSekretne-haslo-przewodnika.\n',
  );
  // Pozostałość po dawnym generatorze kontekstu — nie może wracać na listę.
  writeFileSync(join(project, 'kontekst-agenta.md'), '# Kontekst wiedzy agenta\n');
  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();

  await page.getByTestId('rail-knowledge').click();
  const panel = page.getByTestId('knowledge-panel');
  await expect(panel).toBeVisible();

  // Krótka lista nie może wymuszać suwaka całego panelu (regresja M20).
  expect(
    await panel.evaluate((el) => {
      const scroller = el.closest('.view-panel');
      return scroller ? scroller.scrollHeight - scroller.clientHeight : -1;
    }),
  ).toBeLessThanOrEqual(0);

  // Lista: README + przewodnik, bez pliku dawnego generatora.
  const rows = page.getByTestId('knowledge-file');
  await expect(rows).toHaveCount(2);
  await expect(panel).toContainText('README.md');
  await expect(panel).toContainText('przewodnik.md');
  await expect(panel).not.toContainText('kontekst-agenta.md');
  await expect(panel.getByTestId('knowledge-summary')).toContainText('2 pliki');

  // Pliki z korzenia przed katalogami.
  await expect(rows.first()).toContainText('README.md');

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
