import { expect, test } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

/** Atrapa claude z serwerem obsidian w stanie błędu (Obsidian zamknięty). */
function makeFakeClaudeObsidianBin(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vn3o-obsbin-'));
  const script = [
    '#!/bin/zsh',
    'if [[ "$1" == "mcp" && "$2" == "list" ]]; then',
    "  echo 'Checking MCP server health…'",
    "  echo ''",
    "  echo 'obsidian: http://127.0.0.1:27123/mcp/ (HTTP) - ✘ Failed to connect — ConnectionRefused: odmowa'",
    '  exit 0',
    'fi',
    'exit 1',
    '',
  ].join('\n');
  writeFileSync(join(dir, 'claude'), script, { mode: 0o755 });
  return dir;
}

test('podpowiedź „Uruchom Obsidiana" przy serwerze MCP w stanie błędu', async () => {
  const project = makeFixtureProject();
  const home = mkdtempSync(join(tmpdir(), 'vn3o-home-'));
  writeFileSync(
    join(home, '.claude.json'),
    JSON.stringify({
      mcpServers: { obsidian: { type: 'http', url: 'http://127.0.0.1:27123/mcp/' } },
    }),
  );
  const app = await launchApp(makeConfigHome(), project, {
    HOME: home,
    VISUALN3O_PATH_PREPEND: makeFakeClaudeObsidianBin(),
  });
  const page = await app.firstWindow();

  // Panel MCP: serwer obsidian w stanie błędu → podpowiedź o uruchomieniu Obsidiana.
  await page.getByTestId('rail-mcp').click();
  const obsidianRow = page.locator('.mcp-server', { hasText: 'obsidian' });
  await expect(obsidianRow).toHaveAttribute('data-state', 'error', { timeout: 15_000 });
  await expect(page.getByTestId('obsidian-hint')).toBeVisible();
  await expect(page.getByTestId('obsidian-hint')).toContainText('uruchom Obsidiana');

  await page.screenshot({ path: 'e2e-artifacts/m8-obsidian-hint.png' });
  await app.close();
});
