import { expect, test } from '@playwright/test';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';
import { launchApp, makeConfigHome, makeFixtureProject } from './utils';

/** Klient JSON-RPC po WebSocket — korelacja odpowiedzi po id. */
class RpcClient {
  private ws: WebSocket;
  private waiters = new Map<number, (msg: Record<string, unknown>) => void>();

  constructor(ws: WebSocket) {
    this.ws = ws;
    ws.on('message', (data) => {
      const msg = JSON.parse(String(data)) as Record<string, unknown>;
      const id = msg['id'];
      if (typeof id === 'number' && this.waiters.has(id)) {
        const waiter = this.waiters.get(id);
        this.waiters.delete(id);
        waiter?.(msg);
      }
    });
  }

  request(
    id: number,
    method: string,
    params?: unknown,
    timeoutMs = 20_000,
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters.delete(id);
        reject(new Error(`brak odpowiedzi na ${method}`));
      }, timeoutMs);
      this.waiters.set(id, (msg) => {
        clearTimeout(timer);
        resolve(msg);
      });
      this.ws.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }));
    });
  }

  notify(method: string, params?: unknown): void {
    this.ws.send(JSON.stringify({ jsonrpc: '2.0', method, params }));
  }
}

async function readLockFile(
  configDir: string,
): Promise<{ port: number; authToken: string; lock: Record<string, unknown> }> {
  const ideDir = join(configDir, 'ide');
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const locks = readdirSync(ideDir).filter((name) => name.endsWith('.lock'));
      const first = locks[0];
      if (first) {
        const lock = JSON.parse(readFileSync(join(ideDir, first), 'utf8')) as Record<
          string,
          unknown
        >;
        return {
          port: Number(first.replace('.lock', '')),
          authToken: String(lock['authToken']),
          lock,
        };
      }
    } catch {
      // katalog jeszcze nie istnieje
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('lock file serwera ide nie powstał');
}

function connect(port: number, token: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`, {
      headers: { 'x-claude-code-ide-authorization': token },
    });
    ws.on('open', () => resolve(ws));
    ws.on('error', reject);
  });
}

test('panel Git: klik w zmianę roboczą i plik commita otwiera diff w Monaco', async () => {
  const project = makeFixtureProject();
  // Zmiana robocza przygotowana przed startem — panel czyta status przy montażu.
  writeFileSync(join(project, 'src', 'app.ts'), "export const answer = 43;\n");
  const app = await launchApp(makeConfigHome(), project);
  const page = await app.firstWindow();

  await page.getByTestId('rail-git').click();
  await expect(page.getByTestId('git-panel')).toBeVisible();

  // Diff zmian roboczych.
  const change = page.getByTestId('git-change-file').filter({ hasText: 'src/app.ts' });
  await expect(change).toBeVisible();
  await change.click();
  await expect(page.getByTestId('diff-view')).toBeVisible();
  await expect(page.locator('.monaco-diff-editor')).toBeVisible();
  await page.screenshot({ path: 'e2e-artifacts/m33-diff-roboczy.png' });

  // Diff pliku z commita (init ma README.md i src/app.ts).
  await page.getByTestId('git-commit').first().click();
  const commitFile = page.getByTestId('git-commit-file').filter({ hasText: 'README.md' });
  await expect(commitFile).toBeVisible();
  await commitFile.click();
  await expect(page.getByTestId('tab-active')).toContainText('README.md @');
  await expect(page.locator('.monaco-diff-editor')).toBeVisible();

  await app.close();
});

test('serwer ide: lock file, autoryzacja, openFile i openDiff z decyzją użytkownika', async () => {
  const project = makeFixtureProject();
  const claudeConfig = mkdtempSync(join(tmpdir(), 'vn3o-claude-'));
  const app = await launchApp(makeConfigHome(), project, {
    CLAUDE_CONFIG_DIR: claudeConfig,
  });
  const page = await app.firstWindow();
  await expect(page.getByTestId('editor')).toBeVisible();

  // Lock file zgodny z formatem rozszerzenia VS Code.
  const { port, authToken, lock } = await readLockFile(claudeConfig);
  expect(lock['ideName']).toBe('Sufler');
  expect(lock['transport']).toBe('ws');
  expect(lock['workspaceFolders']).toEqual([project]);
  expect(Number(lock['pid'])).toBeGreaterThan(0);

  // Zły token → serwer odrzuca połączenie.
  await expect(connect(port, 'zly-token')).rejects.toThrow();

  // Poprawny token → handshake MCP.
  const ws = await connect(port, authToken);
  const rpc = new RpcClient(ws);
  const init = await rpc.request(0, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'claude', version: 'e2e' },
  });
  const initResult = init['result'] as {
    serverInfo: { name: string };
    capabilities: { tools: object };
  };
  expect(initResult.serverInfo.name).toBe('Sufler');
  rpc.notify('notifications/initialized');

  const toolsList = await rpc.request(1, 'tools/list');
  const toolNames = (
    (toolsList['result'] as { tools: Array<{ name: string }> }).tools
  ).map((tool) => tool.name);
  expect(toolNames).toContain('openDiff');
  expect(toolNames).toContain('openFile');
  expect(toolNames).toContain('getCurrentSelection');

  // openFile otwiera zakładkę w edytorze.
  await rpc.request(2, 'tools/call', {
    name: 'openFile',
    arguments: { filePath: join(project, 'README.md') },
  });
  await expect(page.getByTestId('tab-active')).toContainText('README.md');

  // openDiff blokuje do decyzji: najpierw odrzucenie…
  const appPath = join(project, 'src', 'app.ts');
  const rejected = rpc.request(3, 'tools/call', {
    name: 'openDiff',
    arguments: {
      old_file_path: appPath,
      new_file_path: appPath,
      new_file_contents: 'export const answer = 100;\n',
      tab_name: 'Propozycja: app.ts',
    },
  });
  await expect(page.getByTestId('diff-bar')).toBeVisible();
  await page.screenshot({ path: 'e2e-artifacts/m33-ide-diff.png' });
  await page.getByTestId('diff-reject').click();
  const rejectedResult = (await rejected)['result'] as {
    content: Array<{ text: string }>;
  };
  expect(rejectedResult.content[0]?.text).toBe('DIFF_REJECTED');

  // …potem zastosowanie: plik na dysku dostaje nową treść.
  const saved = rpc.request(4, 'tools/call', {
    name: 'openDiff',
    arguments: {
      old_file_path: appPath,
      new_file_path: appPath,
      new_file_contents: 'export const answer = 100;\n',
      tab_name: 'Propozycja: app.ts',
    },
  });
  await page.getByTestId('diff-accept').click();
  const savedResult = (await saved)['result'] as { content: Array<{ text: string }> };
  expect(savedResult.content[0]?.text).toBe('FILE_SAVED');
  expect(readFileSync(appPath, 'utf8')).toBe('export const answer = 100;\n');

  ws.close();
  await app.close();
});
