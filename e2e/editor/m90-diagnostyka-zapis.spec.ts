import { expect, test } from '@playwright/test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

/**
 * Tryb „po zapisie" jest ustawieniem trwałym (state.json), więc podstawiamy go
 * wprost zamiast klikać przez kartę Ustawień — test bada, czy ZAPIS uruchamia
 * przebieg, a nie mechanikę przełącznika (tę sprawdza m95).
 */
function makeConfigHomeZAuto(): string {
  const dir = makeConfigHome();
  mkdirSync(join(dir, 'sufler'), { recursive: true });
  writeFileSync(join(dir, 'sufler', 'state.json'), JSON.stringify({ diagnosticsAuto: true }));
  return dir;
}

/** Atrapy narzędzi: `tsc` zgłasza błąd i ostrzeżenie, `eslint` jedno ostrzeżenie. */
function makeFakeTools(project: string): { tsc: string; eslint: string } {
  const dir = mkdtempSync(join(tmpdir(), 'vn3o-diag90-'));
  const tsc = join(dir, 'tsc');
  writeFileSync(
    tsc,
    `#!/bin/sh
cat <<'WYJSCIE'
src/app.ts(3,14): error TS2304: Cannot find name 'nieistniejaca'.
src/app.ts(7,1): warning TS6133: 'nieuzywana' is declared but its value is never read.
WYJSCIE
exit 2
`,
    { mode: 0o755 },
  );
  const eslint = join(dir, 'eslint');
  writeFileSync(
    eslint,
    `#!/bin/sh
cat <<'WYJSCIE'
[{"filePath":"${project}/src/app.ts","messages":[{"ruleId":"eqeqeq","severity":1,"message":"Expected '===' and instead saw '=='.","line":5,"column":9}]}]
WYJSCIE
exit 1
`,
    { mode: 0o755 },
  );
  return { tsc, eslint };
}

test('M90: zapis pliku uruchamia sprawdzenie, gdy tryb „po zapisie" jest włączony', async () => {
  const project = makeFixtureProject();
  const tools = makeFakeTools(project);

  const app = await launchApp(makeConfigHomeZAuto(), project, {
    VISUALN3O_DIAG_TSC: tools.tsc,
    VISUALN3O_DIAG_ESLINT: tools.eslint,
  });
  const page = await app.firstWindow();

  // Zanim ktokolwiek zapisze, wyników nie ma.
  await page.getByTestId('file-tree').getByText('README.md').click();
  await expect(page.getByTestId('tab-active')).toContainText('README.md');
  await expect(page.getByTestId('problems-view')).toHaveCount(0);

  // Zapis sam uruchamia przebieg — bez klikania przycisku sprawdzania.
  // Wpisujemy tak jak m2-editor: klik w wiersze, nie w ukryte textarea.
  await page.locator('.monaco-editor .view-lines').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' dopisek');
  await page.keyboard.press('Meta+s');

  // Karta „Problemy" otwiera się sama z wynikiem — to jest cała funkcja.
  await page.getByTestId('diagnostics-button').click();
  const counts = page.getByTestId('problems-counts');
  await expect(counts).toBeVisible({ timeout: 20_000 });
  await expect(counts).toContainText('1 błąd');

  await page.screenshot({ path: 'e2e-artifacts/m90-diagnostyka-zapis.png' });
  await app.close();
});

test('M90: filtr i „tylko błędy" zawężają listę problemów', async () => {
  const project = makeFixtureProject();
  const tools = makeFakeTools(project);

  const app = await launchApp(makeConfigHome(), project, {
    VISUALN3O_DIAG_TSC: tools.tsc,
    VISUALN3O_DIAG_ESLINT: tools.eslint,
  });
  const page = await app.firstWindow();

  await page.getByTestId('diagnostics-button').click();
  const items = page.getByTestId('problems-item');
  await expect(items).toHaveCount(3, { timeout: 20_000 });

  // Fraza po treści komunikatu.
  await page.getByTestId('problems-filter').fill('Cannot find');
  await expect(items).toHaveCount(1);

  // Zawężenie do błędów odsiewa oba ostrzeżenia.
  await page.getByTestId('problems-filter').fill('');
  await page.getByTestId('problems-only-errors').check();
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText('TS2304');

  await page.screenshot({ path: 'e2e-artifacts/m90-filtr-problemow.png' });
  await app.close();
});
