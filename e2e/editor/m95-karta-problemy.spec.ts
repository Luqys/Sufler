import { expect, test } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

/** Atrapa `tsc`, która mieli dwie sekundy — tylko wtedy widać stan „w toku". */
function makeSlowTools(): { tsc: string; eslint: string } {
  const dir = mkdtempSync(join(tmpdir(), 'vn3o-diag95-'));
  const tsc = join(dir, 'tsc');
  writeFileSync(
    tsc,
    `#!/bin/sh
sleep 2
cat <<'WYJSCIE'
src/app.ts(3,14): error TS2304: Cannot find name 'nieistniejaca'.
src/app.ts(7,1): warning TS6133: 'nieuzywana' is declared but its value is never read.
WYJSCIE
exit 2
`,
    { mode: 0o755 },
  );
  const eslint = join(dir, 'eslint');
  writeFileSync(eslint, `#!/bin/sh\necho '[]'\nexit 0\n`, { mode: 0o755 });
  return { tsc, eslint };
}

test('M95: przycisk w pasku tytułu uruchamia sprawdzenie, animuje je i otwiera kartę', async () => {
  const project = makeFixtureProject();
  writeFileSync(join(project, 'src', 'app.ts'), 'export const a = 1;\n');
  const tools = makeSlowTools();

  const app = await launchApp(makeConfigHome(), project, {
    VISUALN3O_DIAG_TSC: tools.tsc,
    VISUALN3O_DIAG_ESLINT: tools.eslint,
  });
  const page = await app.firstWindow();
  await expect(page.getByTestId('workbench')).toBeVisible();

  // Nad dolnym dokiem nie ma już paska — wyniki należą do środkowego doku.
  await expect(page.getByTestId('problems-view')).toHaveCount(0);

  const przycisk = page.getByTestId('diagnostics-button');
  await expect(przycisk).toBeVisible();
  await przycisk.click();

  // Karta otwiera się od razu, jako zwykła zakładka edytora.
  await expect(page.getByTestId('problems-view')).toBeVisible();
  await expect(page.getByTestId('tab-active')).toContainText('Problemy');

  // ANIMACJA: w trakcie przebiegu przycisk ma stan „w toku" i wiruje.
  await expect(przycisk).toHaveClass(/running/);
  const animacja = await page.evaluate(() => {
    const el = document.querySelector('[data-testid=diagnostics-button] svg');
    return el ? getComputedStyle(el).animationName : '';
  });
  expect(animacja).toBe('diag-spin');

  // Po zakończeniu stan znika, a liczniki pokazują wynik.
  await expect(przycisk).not.toHaveClass(/running/, { timeout: 20_000 });
  await expect(page.getByTestId('problems-counts')).toContainText('1 błąd');
  await expect(page.getByTestId('problems-item')).toHaveCount(2);

  // Licznik błędów siedzi przy przycisku, więc widać go bez otwierania karty.
  await expect(page.getByTestId('diagnostics-button-count')).toHaveText('1');

  await page.screenshot({ path: 'e2e-artifacts/m95-karta-problemy.png' });

  // Klik w problem otwiera plik na właściwej linii.
  await page.getByTestId('problems-item').first().click();
  await expect(page.getByTestId('tab-active')).toContainText('app.ts');

  await app.close();
});
