import { expect, test } from '@playwright/test';
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

function lockInfo(configDir: string): { port: number; token: string } {
  const ideDir = join(configDir, 'ide');
  const first = readdirSync(ideDir).find((name) => name.endsWith('.lock'));
  if (!first) {
    throw new Error('brak lock file serwera');
  }
  const lock = JSON.parse(readFileSync(join(ideDir, first), 'utf8')) as { authToken: string };
  return { port: Number(first.replace('.lock', '')), token: lock.authToken };
}

async function sendHook(
  port: number,
  token: string,
  event: string,
  body: unknown,
): Promise<number> {
  const response = await fetch(`http://127.0.0.1:${port}/hook`, {
    method: 'POST',
    headers: {
      'x-sufler-hook': token,
      'x-sufler-tab': '1',
      'x-sufler-event': event,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  return response.status;
}

test('dziennik sesji: hooki zapisują polecenia i operacje do pliku .md', async () => {
  const project = makeFixtureProject();
  const claudeConfig = mkdtempSync(join(tmpdir(), 'vn3o-claude-'));
  const app = await launchApp(makeConfigHome(), project, { CLAUDE_CONFIG_DIR: claudeConfig });
  const page = await app.firstWindow();
  await expect(page.getByTestId('workbench')).toBeVisible();

  await expect.poll(() => existsSync(join(claudeConfig, 'ide')), { timeout: 15_000 }).toBe(true);
  const { port, token } = lockInfo(claudeConfig);
  const sessionId = 'e2e12345-aaaa-bbbb-cccc-ddddeeeeffff';

  expect(await sendHook(port, token, 'prompt', { session_id: sessionId, prompt: 'Napraw limit planu' })).toBe(204);
  expect(
    await sendHook(port, token, 'tool', {
      session_id: sessionId,
      tool_name: 'Edit',
      tool_input: { file_path: 'src/limits.ts' },
    }),
  ).toBe(204);
  expect(
    await sendHook(port, token, 'tool', {
      session_id: sessionId,
      tool_name: 'Bash',
      tool_input: { command: 'npm test' },
    }),
  ).toBe(204);
  // Narzędzie tylko czytające nie zaśmieca dziennika.
  expect(
    await sendHook(port, token, 'tool', {
      session_id: sessionId,
      tool_name: 'Read',
      tool_input: { file_path: 'src/limits.ts' },
    }),
  ).toBe(204);

  const logDir = join(project, 'dziennik-sesji');
  await expect.poll(() => (existsSync(logDir) ? readdirSync(logDir).length : 0), { timeout: 10_000 }).toBeGreaterThan(0);
  const file = join(logDir, readdirSync(logDir)[0]!);
  await expect.poll(() => readFileSync(file, 'utf8')).toContain('npm test');

  const content = readFileSync(file, 'utf8');
  expect(content).toContain('kategoria: Dziennik sesji');
  expect(content).toContain('Napraw limit planu');
  expect(content).toContain('edycja: `src/limits.ts`');
  expect(content).not.toContain('Read');

  // Dziennik jest notatką .md — panel Wiedza go widzi.
  await page.getByTestId('rail-knowledge').click();
  await expect(page.getByTestId('knowledge-panel')).toContainText('dziennik-sesji', {
    timeout: 10_000,
  });

  // Przełącznik w Ustawieniach wyłącza zapis.
  await page.getByTestId('settings-button').click();
  const toggle = page.getByTestId('session-log-toggle');
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  const before = readFileSync(file, 'utf8');
  expect(await sendHook(port, token, 'prompt', { session_id: sessionId, prompt: 'Po wyłączeniu' })).toBe(204);
  await page.waitForTimeout(500);
  expect(readFileSync(file, 'utf8')).toBe(before);

  await page.screenshot({ path: 'e2e-artifacts/m52-dziennik.png' });
  await app.close();
});
