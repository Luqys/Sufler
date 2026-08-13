import { expect, test } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

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

  const app = await launchApp(makeConfigHome(), project, {
    VISUALN3O_DIAG_TSC: tools.tsc,
    VISUALN3O_DIAG_ESLINT: tools.eslint,
  });
  const page = await app.firstWindow();

  // Bez trybu automatycznego zapis niczego nie uruchamia.
  await page.getByTestId('file-tree').getByText('README.md').click();
  await expect(page.getByTestId('tab-active')).toContainText('README.md');
  await page.keyboard.press('Meta+s');
  await expect(page.getByTestId('diagnostics-counts')).toHaveCount(0);

  // Włączenie trybu i zapis — pasek liczy sam, bez klikania „Sprawdź projekt".
  await page.getByTestId('diagnostics-auto').check();
  // Wpisujemy tak jak m2-editor: klik w wiersze, nie w ukryte textarea.
  await page.locator('.monaco-editor .view-lines').click();
  await page.keyboard.press('End');
  await page.keyboard.type(' dopisek');
  await page.keyboard.press('Meta+s');

  const counts = page.getByTestId('diagnostics-counts');
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

  await page.getByTestId('diagnostics-run').click();
  const items = page.getByTestId('diagnostics-item');
  await expect(items).toHaveCount(3, { timeout: 20_000 });

  // Fraza po treści komunikatu.
  await page.getByTestId('diagnostics-filter').fill('Cannot find');
  await expect(items).toHaveCount(1);

  // Zawężenie do błędów odsiewa oba ostrzeżenia.
  await page.getByTestId('diagnostics-filter').fill('');
  await page.getByTestId('diagnostics-only-errors').check();
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText('TS2304');

  await page.screenshot({ path: 'e2e-artifacts/m90-filtr-problemow.png' });
  await app.close();
});
