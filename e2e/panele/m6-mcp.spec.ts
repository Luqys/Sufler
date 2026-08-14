import { expect, test } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { launchApp, makeConfigHome, makeFixtureProject } from '../utils';

/** Atrapa `claude` obsługująca wyłącznie `mcp list` i `mcp get` w prawdziwym formacie CLI. */
function makeFakeClaudeMcpBin(): string {
  const dir = mkdtempSync(join(tmpdir(), 'vn3o-mcpbin-'));
  const script = [
    '#!/bin/zsh',
    'if [[ "$1" == "mcp" && "$2" == "list" ]]; then',
    "  echo 'Checking MCP server health…'",
    "  echo ''",
    "  echo 'test-serwer: echo hello - ⏸ Pending approval (run `claude` to approve)'",
    "  echo 'zdalny: http://127.0.0.1:1/mcp (HTTP) - ✘ Failed to connect — ConnectionRefused: odmowa'",
    "  echo 'dziala: cos serve - ✔ Connected'",
    '  exit 0',
    'fi',
    'if [[ "$1" == "mcp" && "$2" == "get" ]]; then',
    '  echo "$3:"',
    "  echo '  Scope: Project config (shared via .mcp.json)'",
    "  echo '  Status: ⏸ Pending approval'",
    "  echo '  Type: stdio'",
    "  echo '  Command: echo'",
    "  echo '  Args: hello'",
    '  exit 0',
    'fi',
    'echo "atrapa: nieobsługiwane argumenty: $@"',
    'exit 1',
    '',
  ].join('\n');
  writeFileSync(join(dir, 'claude'), script, { mode: 0o755 });
  return dir;
}

function makeHomeWithUserServer(): string {
  const home = mkdtempSync(join(tmpdir(), 'vn3o-home-'));
  writeFileSync(
    join(home, '.claude.json'),
    JSON.stringify({ mcpServers: { zdalny: { type: 'http', url: 'http://127.0.0.1:1/mcp' } } }),
  );
  return home;
}

test('panel MCP łączy konfigurację ze stanem z CLI', async () => {
  const project = makeFixtureProject();
  writeFileSync(
    join(project, '.mcp.json'),
    JSON.stringify({ mcpServers: { 'test-serwer': { command: 'echo', args: ['hello'] } } }),
  );
  const app = await launchApp(makeConfigHome(), project, {
    HOME: makeHomeWithUserServer(),
    VISUALN3O_PATH_PREPEND: makeFakeClaudeMcpBin(),
  });
  const page = await app.firstWindow();

  await page.getByTestId('rail-mcp').click();
  const panel = page.getByTestId('mcp-panel');
  await expect(panel).toBeVisible();

  // Serwer z .mcp.json: scope project, stan pending (szara kropka) z CLI.
  const testServer = panel.locator('.mcp-server', { hasText: 'test-serwer' });
  await expect(testServer).toHaveAttribute('data-state', 'pending', { timeout: 15_000 });
  await expect(testServer.getByText('project')).toBeVisible();
  await expect(testServer.getByText('stdio')).toBeVisible();

  // Serwer z ~/.claude.json: scope user, stan błędu (czerwona kropka).
  const remote = panel.locator('.mcp-server', { hasText: 'zdalny' });
  await expect(remote).toHaveAttribute('data-state', 'error');
  await expect(remote.getByText('user')).toBeVisible();
  await expect(remote.getByText('http')).toBeVisible();

  // Serwer znany tylko CLI: zielona kropka, bez badge'a scope.
  const cliOnly = panel.locator('.mcp-server', { hasText: 'dziala' });
  await expect(cliOnly).toHaveAttribute('data-state', 'connected');

  // Rozwinięcie pokazuje szczegóły z `claude mcp get`. Od M104 klucz i wartość
  // są w dwóch kolumnach, więc dwukropek zniknął z tekstu klucza.
  await testServer.locator('.mcp-row').click();
  await expect(testServer.getByText('Command', { exact: true })).toBeVisible();
  await expect(testServer.getByText('Project config (shared via .mcp.json)')).toBeVisible();

  await page.screenshot({ path: 'e2e-artifacts/m6-panel-mcp.png' });
  await app.close();
});

test('zmiana .mcp.json odświeża panel bez restartu', async () => {
  const project = makeFixtureProject();
  writeFileSync(
    join(project, '.mcp.json'),
    JSON.stringify({ mcpServers: { 'test-serwer': { command: 'echo', args: ['hello'] } } }),
  );
  const app = await launchApp(makeConfigHome(), project, {
    HOME: makeHomeWithUserServer(),
    VISUALN3O_PATH_PREPEND: makeFakeClaudeMcpBin(),
  });
  const page = await app.firstWindow();

  await page.getByTestId('rail-mcp').click();
  const panel = page.getByTestId('mcp-panel');
  await expect(panel.getByText('test-serwer')).toBeVisible();

  writeFileSync(
    join(project, '.mcp.json'),
    JSON.stringify({
      mcpServers: {
        'test-serwer': { command: 'echo', args: ['hello'] },
        'dodany-w-locie': { type: 'sse', url: 'https://przyklad/sse' },
      },
    }),
  );

  const added = panel.locator('.mcp-server', { hasText: 'dodany-w-locie' });
  await expect(added).toBeVisible({ timeout: 10_000 });
  await expect(added.getByText('sse')).toBeVisible();

  await app.close();
});
