/**
 * Serwer „ide" (SPEC.md, sekcja „Poza zakresem v1"): aplikacja podszywa się
 * pod IDE dla Claude Code CLI. WebSocket + JSON-RPC/MCP na loopbacku, token
 * w lock file'u `~/.claude/ide/<port>.lock`, autoryzacja nagłówkiem
 * `x-claude-code-ide-authorization`. CLI uruchomione w naszych zakładkach
 * (env CLAUDE_CODE_SSE_PORT + ENABLE_IDE_INTEGRATION) otwiera dzięki temu
 * diffy w Monaco i widzi zaznaczenie edytora.
 *
 * Czysta logika protokołu: src/shared/ide-protocol.ts. Tutaj transport,
 * lock file i mostek IPC do renderera.
 */
import { BrowserWindow, app, ipcMain } from 'electron';
import { createServer, type Server } from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  buildLockFileContent,
  handleIdeRpcMessage,
  jsonContent,
  selectionChangedNotification,
  textContent,
  type IdeSelection,
  type ToolResult,
} from '../shared/ide-protocol';
import { IPC, type IdeStatus } from '../shared/ipc';

const BRIDGE_TIMEOUT_MS = 15_000;

let server: Server | null = null;
let wss: WebSocketServer | null = null;
let port: number | null = null;
let lockPath: string | null = null;
let authToken = '';
let getRoot: () => string | null = () => null;
let readyResolve: (() => void) | null = null;
const ready = new Promise<void>((resolve) => {
  readyResolve = resolve;
});

const sockets = new Set<WebSocket>();
let bridgeCounter = 1;
const pendingBridge = new Map<
  number,
  { resolve: (result: unknown) => void; timer: NodeJS.Timeout | null }
>();
let lastSelection: IdeSelection | null = null;

function lockDir(): string {
  const configDir = process.env['CLAUDE_CONFIG_DIR'];
  return configDir ? join(configDir, 'ide') : join(homedir(), '.claude', 'ide');
}

function writeLock(): void {
  if (port === null) {
    return;
  }
  const root = getRoot();
  const dir = lockDir();
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  lockPath = join(dir, `${port}.lock`);
  writeFileSync(
    lockPath,
    buildLockFileContent({
      pid: process.pid,
      workspaceFolders: root ? [root] : [],
      authToken,
    }),
    { mode: 0o600 },
  );
}

/** Po zmianie korzenia projektu lock file musi wskazywać nowy workspace. */
export function updateIdeWorkspaceFolders(): void {
  try {
    writeLock();
  } catch {
    // Brak uprawnień do ~/.claude — integracja ide po prostu nie działa.
  }
}

function tokenMatches(header: unknown): boolean {
  if (typeof header !== 'string' || header.length === 0) {
    return false;
  }
  const expected = Buffer.from(authToken);
  const received = Buffer.from(header);
  return expected.length === received.length && timingSafeEqual(expected, received);
}

/** Żądanie do renderera; odpowiedź wraca kanałem IdeBridgeResponse. */
function bridge(
  method: string,
  params: Record<string, unknown>,
  timeoutMs: number = BRIDGE_TIMEOUT_MS,
): Promise<unknown> {
  const windows = BrowserWindow.getAllWindows().filter((win) => !win.isDestroyed());
  if (windows.length === 0) {
    return Promise.reject(new Error('IDE window is not available'));
  }
  const id = bridgeCounter++;
  return new Promise((resolve, reject) => {
    const timer =
      timeoutMs > 0
        ? setTimeout(() => {
            pendingBridge.delete(id);
            reject(new Error(`IDE did not respond to ${method}`));
          }, timeoutMs)
        : null;
    pendingBridge.set(id, { resolve, timer });
    for (const win of windows) {
      win.webContents.send(IPC.IdeBridgeRequest, { id, method, params });
    }
  });
}

function selectionResult(): ToolResult {
  if (lastSelection === null) {
    return jsonContent({ success: false, message: 'No selection available' });
  }
  return jsonContent({ success: true, ...lastSelection });
}

async function callTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
  switch (name) {
    case 'getWorkspaceFolders': {
      const root = getRoot();
      return jsonContent({ success: true, folders: root ? [root] : [] });
    }
    case 'getDiagnostics':
      // Bez LSP nie ma diagnostyki — pusta lista to poprawna odpowiedź.
      return jsonContent([]);
    case 'getCurrentSelection':
    case 'getLatestSelection':
      return selectionResult();
    case 'openDiff': {
      // Blokujące do decyzji użytkownika (Zastosuj/Odrzuć) — bez timeoutu.
      const outcome = (await bridge('openDiff', args, 0)) as { status?: string };
      return textContent(outcome.status === 'saved' ? 'FILE_SAVED' : 'DIFF_REJECTED');
    }
    case 'openFile':
    case 'getOpenEditors':
    case 'checkDocumentDirty':
    case 'saveDocument':
    case 'close_tab':
    case 'closeAllDiffTabs':
      return jsonContent(await bridge(name, args));
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export function startIdeServer(rootProvider: () => string | null): void {
  getRoot = rootProvider;
  authToken = randomUUID();

  ipcMain.on(IPC.IdeBridgeResponse, (_event, payload: { id: number; result: unknown }) => {
    const pending = pendingBridge.get(payload.id);
    if (pending) {
      pendingBridge.delete(payload.id);
      if (pending.timer) {
        clearTimeout(pending.timer);
      }
      pending.resolve(payload.result);
    }
  });
  ipcMain.on(IPC.IdeSelectionChanged, (_event, selection: IdeSelection) => {
    lastSelection = selection;
    const notification = JSON.stringify(selectionChangedNotification(selection));
    for (const socket of sockets) {
      socket.send(notification);
    }
  });
  ipcMain.handle(IPC.IdeStatusGet, (): IdeStatus => ({ running: port !== null, port }));

  wss = new WebSocketServer({ noServer: true });
  server = createServer((_request, response) => {
    // Zwykłe HTTP nie jest częścią protokołu — tylko upgrade do WebSocketu.
    response.writeHead(426, { 'Content-Type': 'text/plain' });
    response.end('Upgrade Required');
  });
  server.on('upgrade', (request, socket, head) => {
    if (!tokenMatches(request.headers['x-claude-code-ide-authorization'])) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wss?.handleUpgrade(request, socket, head, (webSocket) => {
      sockets.add(webSocket);
      webSocket.on('close', () => sockets.delete(webSocket));
      webSocket.on('error', () => sockets.delete(webSocket));
      webSocket.on('message', (data) => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(String(data));
        } catch {
          return;
        }
        void handleIdeRpcMessage(parsed, callTool, app.getVersion()).then((response) => {
          if (response && webSocket.readyState === webSocket.OPEN) {
            webSocket.send(JSON.stringify(response));
          }
        });
      });
    });
  });
  server.on('error', () => {
    // Port zajęty/inny błąd — aplikacja działa dalej bez integracji ide.
    port = null;
    readyResolve?.();
  });
  server.listen(0, '127.0.0.1', () => {
    const address = server?.address();
    if (address && typeof address === 'object') {
      port = address.port;
      try {
        writeLock();
      } catch {
        port = null;
      }
    }
    readyResolve?.();
  });
}

/** Env dla pty zakładki `claude` — po nim CLI znajduje nasz serwer. */
export async function ideEnvForClaude(): Promise<Record<string, string>> {
  await ready;
  if (port === null) {
    return {};
  }
  return {
    CLAUDE_CODE_SSE_PORT: String(port),
    ENABLE_IDE_INTEGRATION: 'true',
  };
}

export function stopIdeServer(): void {
  // Wiszące openDiff kwitujemy odrzuceniem, żeby CLI nie czekało w nieskończoność.
  for (const pending of pendingBridge.values()) {
    if (pending.timer) {
      clearTimeout(pending.timer);
    }
    pending.resolve({ status: 'rejected' });
  }
  pendingBridge.clear();
  for (const socket of sockets) {
    socket.close();
  }
  sockets.clear();
  wss?.close();
  server?.close();
  wss = null;
  server = null;
  port = null;
  if (lockPath) {
    try {
      rmSync(lockPath);
    } catch {
      // już nie istnieje
    }
    lockPath = null;
  }
}
