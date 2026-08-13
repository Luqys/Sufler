import type {
  McpConfigServer,
  McpDetail,
  McpListEntry,
  McpScope,
  McpTransport,
} from '../../shared/mcp/mcp';

/**
 * Parsery wyjścia `claude mcp …` i plików konfiguracyjnych — celowo w jednym
 * module: format CLI zmienia się między wersjami, więc zmiana ma
 * psuć ten plik i jego testy, a nie całą aplikację.
 *
 * Format `claude mcp list` (przechwycony z wersji rzeczywistej):
 *   Checking MCP server health…
 *
 *   dziala: claude mcp serve - ✔ Connected
 *   zdalny: http://127.0.0.1:1/mcp (HTTP) - ✘ Failed to connect — ConnectionRefused: …
 *   projektowy: echo x - ⏸ Pending approval (run `claude` to approve)
 */

const LIST_LINE = /^([^:]+):\s+(.*)\s+-\s+([✔✓✘✗⏸])\s*(.*)$/u;

function stateForSymbol(symbol: string): McpListEntry['state'] {
  if (symbol === '✔' || symbol === '✓') {
    return 'connected';
  }
  if (symbol === '⏸') {
    return 'pending';
  }
  return 'error';
}

function splitTransport(targetRaw: string): { target: string; transport: McpTransport } {
  const match = /\s+\((HTTP|SSE)\)$/i.exec(targetRaw);
  if (!match) {
    return { target: targetRaw.trim(), transport: 'stdio' };
  }
  return {
    target: targetRaw.slice(0, match.index).trim(),
    transport: match[1]?.toLowerCase() === 'sse' ? 'sse' : 'http',
  };
}

export function parseMcpListOutput(stdout: string): McpListEntry[] {
  const entries: McpListEntry[] = [];
  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line || line.startsWith('Checking MCP server health')) {
      continue;
    }
    const match = LIST_LINE.exec(line);
    if (!match) {
      continue;
    }
    const [, name, targetRaw, symbol, detail] = match;
    if (!name || targetRaw === undefined || !symbol) {
      continue;
    }
    entries.push({
      name: name.trim(),
      ...splitTransport(targetRaw),
      state: stateForSymbol(symbol),
      detail: (detail ?? '').trim(),
    });
  }
  return entries;
}

/**
 * Format `claude mcp get <nazwa>`:
 *   nazwa:
 *     Scope: Local config (private to you in this project)
 *     Status: ✔ Connected
 *     Type: stdio
 *     Command: claude
 *     Args: mcp serve
 *   To remove this server, run: claude mcp remove …
 */
export function parseMcpGetOutput(stdout: string): McpDetail[] {
  const details: McpDetail[] = [];
  for (const line of stdout.split('\n')) {
    const match = /^\s{2,}([A-Za-z][A-Za-z ]*):\s?(.*)$/.exec(line);
    if (!match) {
      continue;
    }
    const key = match[1]?.trim();
    const value = match[2]?.trim() ?? '';
    if (key && value) {
      details.push({ key, value });
    }
  }
  return details;
}

interface RawConfigEntry {
  type?: unknown;
  transport?: unknown;
  url?: unknown;
  command?: unknown;
  args?: unknown;
}

function configEntryToServer(
  name: string,
  raw: RawConfigEntry,
  scope: McpScope,
): McpConfigServer {
  const kind =
    typeof raw.type === 'string' ? raw.type : typeof raw.transport === 'string' ? raw.transport : '';
  const transport: McpTransport = kind === 'http' ? 'http' : kind === 'sse' ? 'sse' : 'stdio';
  const url = typeof raw.url === 'string' ? raw.url : '';
  const command = typeof raw.command === 'string' ? raw.command : '';
  const args = Array.isArray(raw.args) ? raw.args.map(String) : [];
  const target = transport === 'stdio' ? [command, ...args].filter(Boolean).join(' ') : url;
  return { name, scope, transport, target };
}

function serversFromRecord(record: unknown, scope: McpScope): McpConfigServer[] {
  if (typeof record !== 'object' || record === null) {
    return [];
  }
  return Object.entries(record as Record<string, RawConfigEntry>).map(([name, raw]) =>
    configEntryToServer(name, raw ?? {}, scope),
  );
}

/** `<root>/.mcp.json` — scope `project`. */
export function parseMcpJson(content: string): McpConfigServer[] {
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== 'object' || parsed === null) {
      return [];
    }
    return serversFromRecord((parsed as Record<string, unknown>)['mcpServers'], 'project');
  } catch {
    return [];
  }
}

/** `~/.claude.json` — scope `user` (top-level) i `local` (kluczowany ścieżką projektu). */
export function parseClaudeJsonServers(
  content: string,
  projectPath: string,
): { user: McpConfigServer[]; local: McpConfigServer[] } {
  try {
    const parsed: unknown = JSON.parse(content);
    if (typeof parsed !== 'object' || parsed === null) {
      return { user: [], local: [] };
    }
    const obj = parsed as Record<string, unknown>;
    const user = serversFromRecord(obj['mcpServers'], 'user');
    const projects = obj['projects'];
    let local: McpConfigServer[] = [];
    if (typeof projects === 'object' && projects !== null) {
      const projectEntry = (projects as Record<string, unknown>)[projectPath];
      if (typeof projectEntry === 'object' && projectEntry !== null) {
        local = serversFromRecord(
          (projectEntry as Record<string, unknown>)['mcpServers'],
          'local',
        );
      }
    }
    return { user, local };
  } catch {
    return { user: [], local: [] };
  }
}
