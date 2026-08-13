import { describe, expect, it } from 'vitest';
import {
  buildMcpAddArgs,
  isAlreadyExistsError,
  mcpNameProblem,
  mcpTargetProblem,
  parseHeaderLines,
  splitCommandLine,
  type McpAddInput,
} from '../../src/shared/mcp/mcp-add';

function input(overrides: Partial<McpAddInput> = {}): McpAddInput {
  return {
    name: 'supabase',
    transport: 'http',
    url: 'https://mcp.supabase.com/mcp',
    command: '',
    headers: [],
    scope: 'project',
    ...overrides,
  };
}

describe('mcpNameProblem', () => {
  it('przyjmuje nazwy, które przejdą przez JSON i wiersz poleceń', () => {
    expect(mcpNameProblem('supabase')).toBeNull();
    expect(mcpNameProblem('wiedza-graf')).toBeNull();
    expect(mcpNameProblem('serwer_2')).toBeNull();
  });

  it('odrzuca puste, ze spacją i ze znakami specjalnymi', () => {
    expect(mcpNameProblem('')).toBe('empty');
    expect(mcpNameProblem('   ')).toBe('empty');
    expect(mcpNameProblem('mój serwer')).toBe('invalid');
    expect(mcpNameProblem('a/b')).toBe('invalid');
    expect(mcpNameProblem('ż')).toBe('invalid');
    expect(mcpNameProblem('a'.repeat(65))).toBe('too-long');
  });
});

describe('mcpTargetProblem', () => {
  it('http/sse wymaga adresu ze schematem', () => {
    expect(mcpTargetProblem({ transport: 'http', url: 'https://x.pl/mcp', command: '' })).toBeNull();
    expect(mcpTargetProblem({ transport: 'sse', url: '', command: '' })).toBe('url-empty');
    expect(mcpTargetProblem({ transport: 'http', url: 'mcp.supabase.com', command: '' })).toBe(
      'url-scheme',
    );
  });

  it('stdio wymaga komendy, nie adresu', () => {
    expect(mcpTargetProblem({ transport: 'stdio', url: '', command: 'npx serwer' })).toBeNull();
    expect(mcpTargetProblem({ transport: 'stdio', url: '', command: '  ' })).toBe('command-empty');
  });
});

describe('parseHeaderLines', () => {
  it('czyta nagłówki po jednym w wierszu', () => {
    expect(parseHeaderLines('Authorization: Bearer abc\nX-Klucz: 123')).toEqual({
      headers: [
        { name: 'Authorization', value: 'Bearer abc' },
        { name: 'X-Klucz', value: '123' },
      ],
      invalid: [],
    });
  });

  it('wiersz bez dwukropka wraca jako błędny, a nie znika po cichu', () => {
    const parsed = parseHeaderLines('Authorization Bearer abc\n\nX: 1');
    expect(parsed.headers).toEqual([{ name: 'X', value: '1' }]);
    expect(parsed.invalid).toEqual(['Authorization Bearer abc']);
  });

  it('wartość może zawierać dwukropki (np. URL)', () => {
    expect(parseHeaderLines('Referer: https://x.pl:8443/a').headers).toEqual([
      { name: 'Referer', value: 'https://x.pl:8443/a' },
    ]);
  });
});

describe('splitCommandLine', () => {
  it('dzieli po spacjach', () => {
    expect(splitCommandLine('npx -y @scope/serwer')).toEqual(['npx', '-y', '@scope/serwer']);
  });

  it('szanuje cudzysłowy', () => {
    expect(splitCommandLine('node serwer.js "moje dane" \'inne dane\'')).toEqual([
      'node',
      'serwer.js',
      'moje dane',
      'inne dane',
    ]);
  });

  it('pusty argument w cudzysłowie zostaje', () => {
    expect(splitCommandLine('cmd ""')).toEqual(['cmd', '']);
    expect(splitCommandLine('   ')).toEqual([]);
  });
});

describe('buildMcpAddArgs', () => {
  it('http: transport, nazwa, adres i zakres', () => {
    expect(buildMcpAddArgs(input())).toEqual([
      'mcp',
      'add',
      '--transport',
      'http',
      'supabase',
      'https://mcp.supabase.com/mcp',
      '-s',
      'project',
    ]);
  });

  it('nagłówki lecą jako osobne -H', () => {
    const args = buildMcpAddArgs(
      input({ headers: [{ name: 'Authorization', value: 'Bearer abc' }], scope: 'user' }),
    );
    expect(args).toContain('-H');
    expect(args).toContain('Authorization: Bearer abc');
    expect(args.slice(-4)).toEqual(['-s', 'user', '-H', 'Authorization: Bearer abc']);
  });

  it('stdio: komenda po `--`, żeby jej flagi nie trafiły do CLI', () => {
    expect(
      buildMcpAddArgs(
        input({ transport: 'stdio', url: '', command: 'npx -y @scope/serwer --port 3000' }),
      ),
    ).toEqual([
      'mcp',
      'add',
      'supabase',
      '-s',
      'project',
      '--',
      'npx',
      '-y',
      '@scope/serwer',
      '--port',
      '3000',
    ]);
  });

  it('białe znaki wokół nazwy i adresu są obcinane', () => {
    const args = buildMcpAddArgs(input({ name: '  serwer  ', url: '  https://x.pl/mcp  ' }));
    expect(args).toContain('serwer');
    expect(args).toContain('https://x.pl/mcp');
  });
});

describe('isAlreadyExistsError', () => {
  it('rozpoznaje komunikat CLI o istniejącym serwerze', () => {
    expect(isAlreadyExistsError('MCP server supabase already exists in project config')).toBe(true);
    expect(isAlreadyExistsError('Command failed: connection refused')).toBe(false);
  });
});
