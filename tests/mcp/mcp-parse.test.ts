import { describe, expect, it } from 'vitest';
import {
  parseClaudeJsonServers,
  parseMcpGetOutput,
  parseMcpJson,
  parseMcpListOutput,
} from '../../src/main/mcp/parse';
import { mergeMcpServers } from '../../src/shared/mcp/mcp';

/** Fixture przechwycony z rzeczywistego `claude mcp list` (sierpień 2026). */
const REAL_LIST_OUTPUT = `Checking MCP server health…

dziala: claude mcp serve - ✔ Connected
zdalny: http://127.0.0.1:1/mcp (HTTP) - ✘ Failed to connect — ConnectionRefused: Unable to connect. Is the computer able to access the url?
projektowy: echo x - ⏸ Pending approval (run \`claude\` to approve)
lokalny-zepsuty: /usr/bin/false  - ✘ Failed to connect — -32000: MCP error -32000: Connection closed
`;

const REAL_GET_OUTPUT = `dziala:
  Scope: Local config (private to you in this project)
  Status: ✔ Connected
  Type: stdio
  Command: claude
  Args: mcp serve
  Environment:

To remove this server, run: claude mcp remove dziala -s local
`;

describe('parseMcpListOutput', () => {
  it('parsuje rzeczywiste wyjście z trzema stanami', () => {
    const entries = parseMcpListOutput(REAL_LIST_OUTPUT);
    expect(entries).toHaveLength(4);

    expect(entries[0]).toEqual({
      name: 'dziala',
      target: 'claude mcp serve',
      transport: 'stdio',
      state: 'connected',
      detail: 'Connected',
    });
    expect(entries[1]?.name).toBe('zdalny');
    expect(entries[1]?.transport).toBe('http');
    expect(entries[1]?.target).toBe('http://127.0.0.1:1/mcp');
    expect(entries[1]?.state).toBe('error');
    expect(entries[1]?.detail).toContain('ConnectionRefused');
    expect(entries[2]?.state).toBe('pending');
    expect(entries[3]?.state).toBe('error');
    expect(entries[3]?.target).toBe('/usr/bin/false');
  });

  it('obsługuje warianty symboli ✓/✗ i transport SSE', () => {
    const entries = parseMcpListOutput(
      'a: http://x/sse (SSE) - ✓ Connected\nb: cmd - ✗ Failed to connect',
    );
    expect(entries[0]?.transport).toBe('sse');
    expect(entries[0]?.state).toBe('connected');
    expect(entries[1]?.state).toBe('error');
  });

  it('ignoruje nagłówek, puste linie i śmieci', () => {
    expect(parseMcpListOutput('Checking MCP server health…\n\nbez formatu\n')).toEqual([]);
  });
});

describe('parseMcpGetOutput', () => {
  it('parsuje pary klucz-wartość i pomija puste oraz stopkę', () => {
    const details = parseMcpGetOutput(REAL_GET_OUTPUT);
    expect(details).toEqual([
      { key: 'Scope', value: 'Local config (private to you in this project)' },
      { key: 'Status', value: '✔ Connected' },
      { key: 'Type', value: 'stdio' },
      { key: 'Command', value: 'claude' },
      { key: 'Args', value: 'mcp serve' },
    ]);
  });
});

describe('parseMcpJson / parseClaudeJsonServers', () => {
  it('czyta .mcp.json (scope project)', () => {
    const servers = parseMcpJson(
      '{"mcpServers":{"stdio-serwer":{"command":"npx","args":["-y","serwer"]},"webowy":{"type":"http","url":"https://x/mcp"}}}',
    );
    expect(servers).toEqual([
      { name: 'stdio-serwer', scope: 'project', transport: 'stdio', target: 'npx -y serwer' },
      { name: 'webowy', scope: 'project', transport: 'http', target: 'https://x/mcp' },
    ]);
  });

  it('czyta ~/.claude.json: user globalnie, local per projekt', () => {
    const content = JSON.stringify({
      mcpServers: { globalny: { command: 'g' } },
      projects: {
        '/moj/projekt': { mcpServers: { lokalny: { type: 'sse', url: 'https://s/sse' } } },
        '/inny': { mcpServers: { obcy: { command: 'x' } } },
      },
    });
    const { user, local } = parseClaudeJsonServers(content, '/moj/projekt');
    expect(user).toEqual([{ name: 'globalny', scope: 'user', transport: 'stdio', target: 'g' }]);
    expect(local).toEqual([
      { name: 'lokalny', scope: 'local', transport: 'sse', target: 'https://s/sse' },
    ]);
  });

  it('uszkodzony JSON → puste wyniki', () => {
    expect(parseMcpJson('{zepsute')).toEqual([]);
    expect(parseClaudeJsonServers('{zepsute', '/x')).toEqual({ user: [], local: [] });
  });
});

describe('mergeMcpServers', () => {
  it('łączy konfigurację ze stanem CLI i dokłada serwery znane tylko CLI', () => {
    const merged = mergeMcpServers(
      [
        { name: 'a', scope: 'project', transport: 'stdio', target: 'cmd a' },
        { name: 'b', scope: 'user', transport: 'http', target: 'https://b' },
      ],
      [
        { name: 'a', target: 'cmd a', transport: 'stdio', state: 'connected', detail: 'Connected' },
        { name: 'cli-only', target: 'x', transport: 'stdio', state: 'pending', detail: '' },
      ],
    );
    expect(merged.map((s) => [s.name, s.state, s.scope])).toEqual([
      ['a', 'connected', 'project'],
      ['b', 'unknown', 'user'],
      ['cli-only', 'pending', null],
    ]);
  });

  it('bez wyniku CLI wszystko jest unknown', () => {
    const merged = mergeMcpServers(
      [{ name: 'a', scope: 'local', transport: 'stdio', target: 'c' }],
      null,
    );
    expect(merged[0]?.state).toBe('unknown');
  });
});
