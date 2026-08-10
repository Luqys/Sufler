/**
 * Serwer „ide": czysta logika protokołu MCP po JSON-RPC 2.0 (testowana jednostkowo).
 *
 * Aplikacja podszywa się pod IDE dla Claude Code CLI: wystawia WebSocket na
 * loopbacku, a CLI (uruchomione z CLAUDE_CODE_SSE_PORT + ENABLE_IDE_INTEGRATION)
 * łączy się i woła narzędzia openDiff/openFile/getCurrentSelection itd.
 * Transport i mostek do renderera są w src/main/ide-server.ts.
 */

export const IDE_PROTOCOL_VERSION = '2024-11-05';
export const IDE_SERVER_NAME = 'Sufler';

export interface JsonRpcMessage {
  jsonrpc?: string;
  id?: number | string | null;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: unknown;
}

/** Wynik narzędzia MCP: lista bloków treści (u nas zawsze jeden tekstowy). */
export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

export function textContent(text: string): ToolResult {
  return { content: [{ type: 'text', text }] };
}

export function jsonContent(value: unknown): ToolResult {
  return textContent(JSON.stringify(value));
}

/** Zaznaczenie w edytorze — pozycje 0-bazowe (semantyka VS Code, nie Monaco). */
export interface IdeSelection {
  text: string;
  filePath: string;
  fileUrl: string;
  selection: {
    start: { line: number; character: number };
    end: { line: number; character: number };
    isEmpty: boolean;
  };
}

export function selectionChangedNotification(selection: IdeSelection): JsonRpcMessage {
  return { jsonrpc: '2.0', method: 'selection_changed', params: selection };
}

export function atMentionedNotification(
  filePath: string,
  lineStart?: number,
  lineEnd?: number,
): JsonRpcMessage {
  return { jsonrpc: '2.0', method: 'at_mentioned', params: { filePath, lineStart, lineEnd } };
}

export interface IdeToolDefinition {
  name: string;
  description: string;
  inputSchema: { type: 'object'; properties: Record<string, unknown>; required?: string[] };
}

export const IDE_TOOLS: IdeToolDefinition[] = [
  {
    name: 'openDiff',
    description:
      'Open a diff view comparing a file on disk with proposed contents. Blocks until the user accepts or rejects the change.',
    inputSchema: {
      type: 'object',
      properties: {
        old_file_path: { type: 'string' },
        new_file_path: { type: 'string' },
        new_file_contents: { type: 'string' },
        tab_name: { type: 'string' },
      },
      required: ['old_file_path', 'new_file_path', 'new_file_contents'],
    },
  },
  {
    name: 'openFile',
    description: 'Open a file in the editor, optionally selecting a range of text.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string' },
        preview: { type: 'boolean' },
        startText: { type: 'string' },
        endText: { type: 'string' },
        selectToEndOfLine: { type: 'boolean' },
        makeFrontmost: { type: 'boolean' },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'getCurrentSelection',
    description: 'Get the current text selection in the active editor.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'getLatestSelection',
    description: 'Get the most recent text selection, even if the editor lost focus.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'getOpenEditors',
    description: 'List files currently open in editor tabs.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'getWorkspaceFolders',
    description: 'List workspace root folders.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'getDiagnostics',
    description: 'Get language diagnostics (none — this IDE has no LSP).',
    inputSchema: { type: 'object', properties: { uri: { type: 'string' } } },
  },
  {
    name: 'checkDocumentDirty',
    description: 'Check whether a file has unsaved changes in the editor.',
    inputSchema: {
      type: 'object',
      properties: { filePath: { type: 'string' } },
      required: ['filePath'],
    },
  },
  {
    name: 'saveDocument',
    description: 'Save an open editor document to disk.',
    inputSchema: {
      type: 'object',
      properties: { filePath: { type: 'string' } },
      required: ['filePath'],
    },
  },
  {
    name: 'close_tab',
    description: 'Close an editor tab by its name.',
    inputSchema: {
      type: 'object',
      properties: { tab_name: { type: 'string' } },
      required: ['tab_name'],
    },
  },
  {
    name: 'closeAllDiffTabs',
    description: 'Close all open diff tabs.',
    inputSchema: { type: 'object', properties: {} },
  },
];

export type IdeToolHandler = (
  name: string,
  args: Record<string, unknown>,
) => Promise<ToolResult>;

function rpcResult(id: number | string | null, result: unknown): JsonRpcMessage {
  return { jsonrpc: '2.0', id, result };
}

function rpcError(id: number | string | null, code: number, message: string): JsonRpcMessage {
  return { jsonrpc: '2.0', id, error: { code, message } };
}

/**
 * Obsługa jednej wiadomości JSON-RPC od CLI. Zwraca odpowiedź do wysłania
 * albo null (notyfikacje i odpowiedzi nie wymagają reakcji).
 */
export async function handleIdeRpcMessage(
  raw: unknown,
  callTool: IdeToolHandler,
  serverVersion = '1.0.0',
): Promise<JsonRpcMessage | null> {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }
  const msg = raw as JsonRpcMessage;
  if (typeof msg.method !== 'string') {
    // Odpowiedź na nasze żądanie albo śmieć — ignorujemy.
    return null;
  }
  const id = msg.id;
  if (id === undefined || id === null) {
    // Notyfikacja (np. notifications/initialized) — bez odpowiedzi.
    return null;
  }

  switch (msg.method) {
    case 'initialize':
      return rpcResult(id, {
        protocolVersion: IDE_PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: true } },
        serverInfo: { name: IDE_SERVER_NAME, version: serverVersion },
      });
    case 'ping':
      return rpcResult(id, {});
    case 'tools/list':
      return rpcResult(id, { tools: IDE_TOOLS });
    case 'tools/call': {
      const params = (msg.params ?? {}) as { name?: unknown; arguments?: unknown };
      if (typeof params.name !== 'string') {
        return rpcError(id, -32602, 'tools/call requires a tool name');
      }
      const args =
        typeof params.arguments === 'object' && params.arguments !== null
          ? (params.arguments as Record<string, unknown>)
          : {};
      try {
        return rpcResult(id, await callTool(params.name, args));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return rpcResult(id, { ...textContent(message), isError: true });
      }
    }
    default:
      return rpcError(id, -32601, `Method not found: ${msg.method}`);
  }
}

/** Zawartość lock file'a `~/.claude/ide/<port>.lock` — po nim CLI znajduje IDE. */
export function buildLockFileContent(options: {
  pid: number;
  workspaceFolders: string[];
  authToken: string;
}): string {
  return JSON.stringify({
    pid: options.pid,
    workspaceFolders: options.workspaceFolders,
    ideName: IDE_SERVER_NAME,
    transport: 'ws',
    runningInWindows: false,
    authToken: options.authToken,
  });
}
