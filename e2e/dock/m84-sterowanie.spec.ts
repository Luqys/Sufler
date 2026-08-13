import { expect, test } from '@playwright/test';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

/**
 * M84 — sterowanie sesją Claude z paska karty. Atrapa `claude` zapisuje
 * WSZYSTKO, co dostaje na wejściu, do pliku: dzięki temu test sprawdza bajty,
 * które naprawdę poszły do pty, a nie to, co pokazał terminal.
 */
function makeEchoingClaudeBin(): { dir: string; log: string } {
  const dir = mkdtempSync(join(tmpdir(), 'vn3o-sterowanie-'));
  const log = join(dir, 'wejscie.txt');
  const script = [
    '#!/bin/zsh',
    'echo "── Claude Code (atrapa sterowania) ──"',
    // Nagłówek jak w prawdziwym CLI — z niego panel czyta stan (M92).
    'echo "Opus 5 (1M context) with xhigh · Claude Max · konto@example.com"',
    'echo "? for shortcuts"',
    'stty raw -echo 2>/dev/null',
    // `cat` bez bufora: każdy bajt z pty ląduje w pliku i na ekranie.
    `exec tee -a ${log}`,
    '',
  ].join('\n');
  writeFileSync(join(dir, 'claude'), script, { mode: 0o755 });
  return { dir, log };
}

test('przyciski wysyłają do sesji komendy, które CLI naprawdę zna', async () => {
  const fake = makeEchoingClaudeBin();
  const app = await launchApp(makeConfigHome(), makeFixtureProject(), {
    VISUALN3O_PATH_PREPEND: fake.dir,
  });
  const page = await app.firstWindow();

  await page.getByTestId('bottom-new-claude').click();
  await expect(page.locator('[data-testid=bottom-dock] .xterm')).toContainText('atrapa sterowania', {
    timeout: 15_000,
  });

  // Sterowanie jest tylko przy kartach Claude.
  await page.getByTestId('bottom-claude-controls').click();
  const menu = page.getByTestId('bottom-claude-controls-menu');
  await expect(menu).toBeVisible();

  await page.getByTestId('claude-model-opus').click();
  await expect(menu).toHaveCount(0);

  await page.getByTestId('bottom-claude-controls').click();
  await page.getByTestId('claude-effort-xhigh').click();

  await page.getByTestId('bottom-claude-controls').click();
  await page.getByTestId('claude-permission-cycle').click();

  await page.getByTestId('bottom-claude-controls').click();
  await page.getByTestId('claude-compact').click();

  await expect
    .poll(() => readFileSync(fake.log, 'utf8'), { timeout: 15_000 })
    .toContain('/compact');
  const wejscie = readFileSync(fake.log, 'utf8');
  expect(wejscie).toContain('/model opus');
  expect(wejscie).toContain('/effort xhigh');
  // Tryb uprawnień nie ma komendy — leci CSI Z (shift+tab).
  expect(wejscie).toContain(`${String.fromCharCode(27)}[Z`);

  await page.screenshot({ path: 'e2e-artifacts/m84-sterowanie.png' });
  await app.close();
});

test('panel pokazuje AKTUALNY model i głębokość myślenia, nie tylko przełączniki', async () => {
  const fake = makeEchoingClaudeBin();
  const app = await launchApp(makeConfigHome(), makeFixtureProject(), {
    VISUALN3O_PATH_PREPEND: fake.dir,
  });
  const page = await app.firstWindow();

  await page.getByTestId('bottom-new-claude').click();
  await expect(page.locator('[data-testid=bottom-dock] .xterm')).toContainText('atrapa sterowania', {
    timeout: 15_000,
  });

  await page.getByTestId('bottom-claude-controls').click();
  // Stan wzięty z nagłówka sesji, nie z tego, co klikaliśmy.
  await expect(page.getByTestId('claude-controls-now')).toContainText('Opus 5 (1M context)');
  await expect(page.getByTestId('claude-controls-now')).toContainText('xhigh');
  await expect(page.getByTestId('claude-model-opus')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('claude-model-sonnet')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('claude-effort-xhigh')).toHaveAttribute('aria-pressed', 'true');

  await page.screenshot({ path: 'e2e-artifacts/m92-stan-sesji.png' });
  await app.close();
});

test('przeniesienie rozmowy otwiera nową sesję z dziennikiem poprzedniej', async () => {
  const projekt = makeFixtureProject();
  // Dziennik sesji z poprzedniej pracy — to on niesie kontekst.
  const dziennik = 'dziennik-sesji/2026-08-13-abcdef.md';
  writeFileSync(
    join(projekt, 'README.md'),
    '# projekt testowy\n',
  );
  const fs = await import('node:fs');
  fs.mkdirSync(join(projekt, 'dziennik-sesji'), { recursive: true });
  writeFileSync(
    join(projekt, dziennik),
    '# Sesja 2026-08-13\n\n## 10:00 — polecenie\n\nDodaj eksport do CSV\n\n- `10:01` Edit src/eksport.ts\n',
  );

  const fake = makeEchoingClaudeBin();
  const app = await launchApp(makeConfigHome(), projekt, {
    VISUALN3O_PATH_PREPEND: fake.dir,
  });
  const page = await app.firstWindow();

  await page.getByTestId('bottom-new-claude').click();
  await expect(page.locator('[data-testid=bottom-dock] .xterm')).toContainText('atrapa sterowania', {
    timeout: 15_000,
  });

  await page.getByTestId('bottom-claude-controls').click();
  await page.getByTestId('claude-handover').click();

  // Powstaje DRUGA karta Claude…
  await expect(page.locator('[data-testid=bottom-dock] .dock-tab')).toHaveCount(2, {
    timeout: 20_000,
  });
  // …a do jej sesji wjeżdża polecenie wskazujące dziennik poprzedniej.
  await expect
    .poll(() => readFileSync(fake.log, 'utf8'), { timeout: 20_000 })
    .toContain(`@${dziennik}`);
  expect(readFileSync(fake.log, 'utf8')).toContain('nie zaczynaj pracy sam');

  await app.close();
});
