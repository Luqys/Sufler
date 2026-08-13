/**
 * Dodawanie serwera MCP z aplikacji (M79). Panel dotąd tylko czytał
 * konfigurację i stan z CLI — nowy serwer trzeba było dopisać w terminalu
 * albo ręcznie w pliku.
 *
 * Zapis idzie przez `claude mcp add`, a nie przez własne pisanie do
 * `.mcp.json` / `~/.claude.json`: to CLI zna układ pól i zakresów, a aplikacja
 * i tak czyta stan z `claude mcp list`. Tu jest czysta logika — walidacja
 * i budowa argumentów — testowana jednostkowo.
 */

export type McpTransport = 'http' | 'sse' | 'stdio';

/** Zakresy CLI: lokalny (tylko ja, ten projekt), projektu (.mcp.json), użytkownika. */
export type McpScope = 'local' | 'project' | 'user';

export interface McpHeader {
  name: string;
  value: string;
}

export interface McpAddInput {
  name: string;
  transport: McpTransport;
  /** Dla http/sse. */
  url: string;
  /** Dla stdio: komenda wraz z argumentami, jak w wierszu poleceń. */
  command: string;
  headers: McpHeader[];
  scope: McpScope;
}

export type McpNameProblem = 'empty' | 'invalid' | 'too-long';
export type McpTargetProblem = 'url-empty' | 'url-scheme' | 'command-empty';

const NAME_MAX = 64;
/** Nazwa trafia do JSON-a i do wiersza poleceń — bez spacji i znaków specjalnych. */
const NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

export function mcpNameProblem(name: string): McpNameProblem | null {
  const trimmed = name.trim();
  if (trimmed === '') {
    return 'empty';
  }
  if (trimmed.length > NAME_MAX) {
    return 'too-long';
  }
  return NAME_PATTERN.test(trimmed) ? null : 'invalid';
}

export function mcpTargetProblem(input: {
  transport: McpTransport;
  url: string;
  command: string;
}): McpTargetProblem | null {
  if (input.transport === 'stdio') {
    return input.command.trim() === '' ? 'command-empty' : null;
  }
  const url = input.url.trim();
  if (url === '') {
    return 'url-empty';
  }
  return /^https?:\/\/\S+$/i.test(url) ? null : 'url-scheme';
}

/**
 * Nagłówki z pola tekstowego: po jednym w wierszu, `Nazwa: wartość`.
 * Wiersze bez dwukropka wracają jako `invalid` — kreator pokazuje je wprost,
 * zamiast po cichu gubić token uwierzytelniający.
 */
export function parseHeaderLines(text: string): { headers: McpHeader[]; invalid: string[] } {
  const headers: McpHeader[] = [];
  const invalid: string[] = [];
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === '') {
      continue;
    }
    const colon = trimmed.indexOf(':');
    const name = colon === -1 ? '' : trimmed.slice(0, colon).trim();
    const value = colon === -1 ? '' : trimmed.slice(colon + 1).trim();
    if (name === '' || value === '') {
      invalid.push(trimmed);
      continue;
    }
    headers.push({ name, value });
  }
  return { headers, invalid };
}

/**
 * Podział komendy stdio na argumenty, z poszanowaniem cudzysłowów —
 * `npx -y @scope/serwer "moje dane"` ma dojść w trzech kawałkach, nie czterech.
 */
export function splitCommandLine(text: string): string[] {
  const parts: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let pending = false;
  for (const character of text.trim()) {
    if (quote) {
      if (character === quote) {
        quote = null;
      } else {
        current += character;
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      pending = true;
      continue;
    }
    if (/\s/.test(character)) {
      if (current !== '' || pending) {
        parts.push(current);
        current = '';
        pending = false;
      }
      continue;
    }
    current += character;
  }
  if (current !== '' || pending) {
    parts.push(current);
  }
  return parts;
}

/**
 * Argumenty dla `claude`. Dla stdio komenda idzie po `--`, żeby jej własne
 * flagi (np. `-y`) nie zostały zjedzone przez CLI.
 */
export function buildMcpAddArgs(input: McpAddInput): string[] {
  const name = input.name.trim();
  const scope = ['-s', input.scope];
  if (input.transport === 'stdio') {
    return ['mcp', 'add', name, ...scope, '--', ...splitCommandLine(input.command)];
  }
  const headers = input.headers.flatMap((header) => ['-H', `${header.name}: ${header.value}`]);
  return [
    'mcp',
    'add',
    '--transport',
    input.transport,
    name,
    input.url.trim(),
    ...scope,
    ...headers,
  ];
}

/** Czy komunikat CLI mówi „taki serwer już jest". */
export function isAlreadyExistsError(message: string): boolean {
  return /already exists/i.test(message);
}
