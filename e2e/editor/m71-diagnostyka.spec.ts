import { expect, test } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

/**
 * Atrapy `tsc` i `eslint` z zamrożonym wyjściem. Prawdziwy toolchain
 * w katalogu tymczasowym oznaczałby instalowanie zależności w teście —
 * aplikacja pozwala podstawić binarki zmiennymi środowiskowymi.
 */
function makeFakeTools(project: string): { tsc: string; eslint: string } {
  const dir = mkdtempSync(join(tmpdir(), 'vn3o-diag-'));
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
[{"filePath":"${project}/src/app.ts","messages":[{"ruleId":"eqeqeq","severity":2,"message":"Expected '===' and instead saw '=='.","line":5,"column":9}]}]
WYJSCIE
exit 1
`,
    { mode: 0o755 },
  );
  return { tsc, eslint };
}

test('M71: pasek diagnostyki liczy błędy z tsc i eslint, a klik skacze do linii', async () => {
  const project = makeFixtureProject();
  writeFileSync(
    join(project, 'src', 'app.ts'),
    [
      'export const answer = 42;',
      '',
      'export const zle = nieistniejaca;',
      '',
      'export const rowne = answer == 42;',
      '',
      'const nieuzywana = 1;',
      '',
    ].join('\n'),
  );
  const tools = makeFakeTools(project);

  const app = await launchApp(makeConfigHome(), project, {
    VISUALN3O_DIAG_TSC: tools.tsc,
    VISUALN3O_DIAG_ESLINT: tools.eslint,
  });
  const page = await app.firstWindow();

  // M95: sprawdzanie uruchamia przycisk w pasku tytułu, a wyniki są kartą
  // w obszarze edytora — nie paskiem nad dolnym dokiem.
  await expect(page.getByTestId('diagnostics-button')).toBeVisible();
  await expect(page.getByTestId('problems-view')).toHaveCount(0);

  await page.getByTestId('diagnostics-button').click();
  await expect(page.getByTestId('problems-view')).toBeVisible();

  const counts = page.getByTestId('problems-counts');
  await expect(counts).toBeVisible({ timeout: 15_000 });
  // Dwa błędy (tsc + eslint) i jedno ostrzeżenie — z polską odmianą.
  await expect(counts).toContainText('2 błędy');
  await expect(counts).toContainText('1 ostrzeżenie');

  const items = page.getByTestId('problems-item');
  await expect(items).toHaveCount(3);
  await expect(items.first()).toContainText('src/app.ts:3');
  await expect(items.first()).toContainText('Cannot find name');

  await page.screenshot({ path: 'e2e-artifacts/m71-diagnostyka.png' });

  // Klik otwiera plik i ustawia kursor na wskazanej linii.
  await items.first().click();
  await expect(page.getByTestId('tab-active')).toContainText('app.ts');

  /*
   * Plik otwarty PO sprawdzeniu też dostaje podkreślenia — model powstaje
   * dopiero przy otwarciu. Sprawdzamy OBECNOŚĆ falki, nie jej widoczność:
   * przy równolegle działającym drugim przebiegu e2e okno bywa w tle i test
   * padał na warunku widoczności, choć dekoracja była w DOM.
   */
  await expect
    .poll(() => page.locator('.squiggly-error').count(), { timeout: 10_000 })
    .toBeGreaterThan(0);

  await page.screenshot({ path: 'e2e-artifacts/m71-diagnostyka-skok.png' });
  await app.close();
});

test('M71: brak narzędzia mówi to wprost zamiast udawać czysty projekt', async () => {
  const project = makeFixtureProject();
  const app = await launchApp(makeConfigHome(), project, {
    VISUALN3O_DIAG_TSC: join(tmpdir(), 'nie-ma-takiej-binarki-tsc'),
    VISUALN3O_DIAG_ESLINT: join(tmpdir(), 'nie-ma-takiej-binarki-eslint'),
  });
  const page = await app.firstWindow();

  await page.getByTestId('diagnostics-button').click();
  const failed = page.getByTestId('problems-failed');
  await expect(failed.first()).toBeVisible({ timeout: 15_000 });
  await expect(failed).toHaveCount(2);

  await app.close();
});
