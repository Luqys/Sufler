import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

function lockInfo(configDir: string): { port: number; token: string } {
  const ideDir = join(configDir, 'ide');
  const first = readdirSync(ideDir).find((name) => name.endsWith('.lock'));
  if (!first) {
    throw new Error('brak lock file');
  }
  const lock = JSON.parse(readFileSync(join(ideDir, first), 'utf8')) as { authToken: string };
  return { port: Number(first.replace('.lock', '')), token: lock.authToken };
}

test('punkt przywracania powstaje przy poleceniu i cofa zmiany Claude', async () => {
  const project = makeFixtureProject();
  const claudeConfig = mkdtempSync(join(tmpdir(), 'vn3o-claude-'));
  const target = join(project, 'src', 'app.ts');
  const original = readFileSync(target, 'utf8');

  const app = await launchApp(makeConfigHome(), project, { CLAUDE_CONFIG_DIR: claudeConfig });
  const page = await app.firstWindow();
  await expect(page.getByTestId('workbench')).toBeVisible();
  await expect.poll(() => existsSync(join(claudeConfig, 'ide')), { timeout: 15_000 }).toBe(true);
  const { port, token } = lockInfo(claudeConfig);

  // Polecenie dla Claude → migawka drzewa sprzed pracy.
  await fetch(`http://127.0.0.1:${port}/hook`, {
    method: 'POST',
    headers: {
      'x-sufler-hook': token,
      'x-sufler-tab': '1',
      'x-sufler-event': 'prompt',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ session_id: 'ckpt-1234', prompt: 'Przepisz moduł aplikacji' }),
  });

  await page.getByTestId('rail-git').click();
  const rows = page.getByTestId('checkpoint-row');
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  await expect(rows.first()).toContainText('Przepisz moduł aplikacji');
  expect(
    execFileSync('git', ['rev-parse', 'HEAD'], { cwd: project, encoding: 'utf8' }),
  ).toBeTruthy();

  // „Claude" psuje plik — przywracamy migawkę.
  writeFileSync(target, 'export const zepsute = true;\n');
  await rows.first().getByTestId('checkpoint-restore').click();
  await page.getByTestId('confirm-accept').click();
  await expect.poll(() => readFileSync(target, 'utf8'), { timeout: 15_000 }).toBe(original);

  // Cofnięcie samo jest odwracalne — doszła migawka stanu sprzed przywrócenia.
  await expect.poll(() => rows.count()).toBeGreaterThanOrEqual(2);
  await page.screenshot({ path: 'e2e-artifacts/m55-punkty.png' });

  await app.close();
});
