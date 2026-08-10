import { expect, test } from '@playwright/test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

test('motyw ciemny i akcent przeżywają restart (nativeTheme + data-accent)', async () => {
  const configHome = makeConfigHome();
  const project = makeFixtureProject();

  let app = await launchApp(configHome, project);
  let page = await app.firstWindow();
  // Playwright domyślnie emuluje prefers-color-scheme: light — zdejmujemy
  // emulację, żeby media query podążała za nativeTheme jak w prawdziwym użyciu.
  await page.emulateMedia({ colorScheme: null });
  await expect(page.getByTestId('workbench')).toBeVisible();

  await page.keyboard.press('Meta+Comma');
  await expect(page.getByTestId('settings-dialog')).toBeVisible();
  await page.getByTestId('theme-dark').click();
  await page.getByTestId('accent-blue').click();

  await expect
    .poll(() => page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches))
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset['accent']))
    .toBe('blue');

  await page.screenshot({ path: 'e2e-artifacts/m11-motyw-ciemny.png' });
  await app.close();

  // Po restarcie: tryb ustawiony przy starcie main, akcent nałożony w App.
  app = await launchApp(configHome, project);
  page = await app.firstWindow();
  await page.emulateMedia({ colorScheme: null });
  await expect(page.getByTestId('workbench')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => matchMedia('(prefers-color-scheme: dark)').matches))
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.dataset['accent']))
    .toBe('blue');
  await app.close();
});

test('panel MCP pokazuje ikony znanych serwerów (obsidian, supabase)', async () => {
  const project = makeFixtureProject();
  writeFileSync(
    join(project, '.mcp.json'),
    JSON.stringify({
      mcpServers: {
        obsidian: { type: 'http', url: 'http://127.0.0.1:27123/mcp/' },
        supabase: { command: 'npx', args: ['supabase-mcp'] },
        'wlasny-serwer': { command: 'echo' },
      },
    }),
  );
  const home = mkdtempSync(join(tmpdir(), 'vn3o-home-'));
  const app = await launchApp(makeConfigHome(), project, { HOME: home });
  const page = await app.firstWindow();

  await page.getByTestId('rail-mcp').click();
  const panel = page.getByTestId('mcp-panel');
  await expect(panel.locator('svg[data-icon=obsidian]')).toBeVisible();
  await expect(panel.locator('svg[data-icon=supabase]')).toBeVisible();
  await expect(
    panel.locator('.mcp-server', { hasText: 'wlasny-serwer' }).locator('svg[data-icon=mcp]'),
  ).toBeVisible();

  await page.screenshot({ path: 'e2e-artifacts/m11-ikony-mcp.png' });
  await app.close();
});

test('wskaźnik zużycia liczy tokeny z transkryptów ~/.claude/projects', async () => {
  const home = mkdtempSync(join(tmpdir(), 'vn3o-home-'));
  const transcripts = join(home, '.claude', 'projects', '-Users-test-projekt');
  mkdirSync(transcripts, { recursive: true });
  const today = new Date().toISOString();
  const lines = [
    JSON.stringify({
      type: 'assistant',
      timestamp: today,
      message: {
        model: 'claude-fable-5',
        usage: {
          input_tokens: 10,
          output_tokens: 500,
          cache_read_input_tokens: 21349,
          cache_creation_input_tokens: 7839,
        },
      },
    }),
    JSON.stringify({ type: 'user', message: { content: 'pytanie' } }),
    JSON.stringify({
      type: 'assistant',
      timestamp: today,
      message: {
        model: 'claude-fable-5',
        usage: { input_tokens: 5, output_tokens: 700, cache_read_input_tokens: 0 },
      },
    }),
  ];
  writeFileSync(join(transcripts, 'sesja.jsonl'), lines.join('\n') + '\n');

  const app = await launchApp(makeConfigHome(), makeFixtureProject(), { HOME: home });
  const page = await app.firstWindow();

  await page.getByTestId('usage-button').click();
  const panel = page.getByTestId('usage-panel');
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('Dziś');
  await expect(panel).toContainText('1,2 tys.'); // 500 + 700 tokenów wyjścia
  await expect(panel).toContainText('claude-fable-5');
  await expect(panel).toContainText('2 odp.');

  await page.screenshot({ path: 'e2e-artifacts/m11-zuzycie.png' });
  await app.close();
});
