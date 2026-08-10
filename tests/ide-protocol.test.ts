import { describe, expect, it } from 'vitest';
import {
  buildLockFileContent,
  handleIdeRpcMessage,
  IDE_PROTOCOL_VERSION,
  IDE_SERVER_NAME,
  IDE_TOOLS,
  jsonContent,
  selectionChangedNotification,
  textContent,
  type ToolResult,
} from '../src/shared/ide-protocol';

const nigdy = async (): Promise<ToolResult> => {
  throw new Error('nie powinno być wołane');
};

describe('handleIdeRpcMessage', () => {
  it('odpowiada na initialize wersją protokołu i nazwą serwera', async () => {
    const response = await handleIdeRpcMessage(
      { jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-03-26' } },
      nigdy,
      '9.9.9',
    );
    expect(response).not.toBeNull();
    const result = response?.result as {
      protocolVersion: string;
      capabilities: { tools: object };
      serverInfo: { name: string; version: string };
    };
    expect(result.protocolVersion).toBe(IDE_PROTOCOL_VERSION);
    expect(result.serverInfo.name).toBe(IDE_SERVER_NAME);
    expect(result.serverInfo.version).toBe('9.9.9');
    expect(result.capabilities.tools).toBeDefined();
  });

  it('zwraca pełną listę narzędzi na tools/list', async () => {
    const response = await handleIdeRpcMessage(
      { jsonrpc: '2.0', id: 1, method: 'tools/list' },
      nigdy,
    );
    const result = response?.result as { tools: typeof IDE_TOOLS };
    const names = result.tools.map((tool) => tool.name);
    expect(names).toContain('openDiff');
    expect(names).toContain('openFile');
    expect(names).toContain('getCurrentSelection');
    expect(names).toContain('getWorkspaceFolders');
    expect(names).toContain('closeAllDiffTabs');
    expect(result.tools.every((tool) => tool.inputSchema.type === 'object')).toBe(true);
  });

  it('deleguje tools/call do handlera i przekazuje argumenty', async () => {
    let seenName = '';
    let seenArgs: Record<string, unknown> = {};
    const response = await handleIdeRpcMessage(
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'openFile', arguments: { filePath: '/tmp/x.ts' } },
      },
      async (name, args) => {
        seenName = name;
        seenArgs = args;
        return textContent('OK');
      },
    );
    expect(seenName).toBe('openFile');
    expect(seenArgs).toEqual({ filePath: '/tmp/x.ts' });
    expect(response?.result).toEqual({ content: [{ type: 'text', text: 'OK' }] });
  });

  it('błąd handlera zamienia na wynik isError, nie wyjątek RPC', async () => {
    const response = await handleIdeRpcMessage(
      { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'openDiff' } },
      async () => {
        throw new Error('brak okna');
      },
    );
    const result = response?.result as ToolResult;
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toBe('brak okna');
  });

  it('nieznana metoda z id dostaje błąd -32601', async () => {
    const response = await handleIdeRpcMessage(
      { jsonrpc: '2.0', id: 4, method: 'resources/list' },
      nigdy,
    );
    expect((response?.error as { code: number }).code).toBe(-32601);
  });

  it('notyfikacje i odpowiedzi ignoruje (null)', async () => {
    expect(
      await handleIdeRpcMessage(
        { jsonrpc: '2.0', method: 'notifications/initialized' },
        nigdy,
      ),
    ).toBeNull();
    expect(await handleIdeRpcMessage({ jsonrpc: '2.0', id: 5, result: {} }, nigdy)).toBeNull();
    expect(await handleIdeRpcMessage('nie-obiekt', nigdy)).toBeNull();
    expect(await handleIdeRpcMessage(null, nigdy)).toBeNull();
  });

  it('ping odpowiada pustym wynikiem', async () => {
    const response = await handleIdeRpcMessage({ jsonrpc: '2.0', id: 6, method: 'ping' }, nigdy);
    expect(response?.result).toEqual({});
  });
});

describe('buildLockFileContent', () => {
  it('buduje JSON zgodny z formatem rozszerzenia VS Code', () => {
    const parsed = JSON.parse(
      buildLockFileContent({ pid: 123, workspaceFolders: ['/proj'], authToken: 'tok' }),
    );
    expect(parsed).toEqual({
      pid: 123,
      workspaceFolders: ['/proj'],
      ideName: IDE_SERVER_NAME,
      transport: 'ws',
      runningInWindows: false,
      authToken: 'tok',
    });
  });
});

describe('pomocnicze', () => {
  it('jsonContent serializuje wynik do bloku tekstowego', () => {
    expect(jsonContent({ success: true })).toEqual({
      content: [{ type: 'text', text: '{"success":true}' }],
    });
  });

  it('selectionChangedNotification nie ma id (to notyfikacja)', () => {
    const notification = selectionChangedNotification({
      text: 'abc',
      filePath: '/f.ts',
      fileUrl: 'file:///f.ts',
      selection: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 3 },
        isEmpty: false,
      },
    });
    expect(notification.method).toBe('selection_changed');
    expect(notification.id).toBeUndefined();
  });
});
