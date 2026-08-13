/**
 * Diagnostyka projektu bez LSP (M71). Pełne `monaco-languageclient` zostaje
 * poza zakresem — to granica „nie klonujemy VS Code" —
 * ale edytor bez podkreślonych błędów jest notatnikiem. Tańszy substytut:
 * uruchamiamy `tsc` i `eslint` na żądanie i pokazujemy ich wynik.
 *
 * Tutaj wyłącznie parsowanie i porządkowanie — testowane jednostkowo na
 * zamrożonych fixture'ach wyjścia obu narzędzi. Format `tsc` zmienia się
 * między wersjami, więc ma zepsuć jeden plik, a nie całą aplikację.
 */

export type DiagnosticSeverity = 'error' | 'warning';
export type DiagnosticSource = 'tsc' | 'eslint';

export interface Diagnostic {
  /** Ścieżka względem korzenia projektu. */
  file: string;
  line: number;
  column: number;
  severity: DiagnosticSeverity;
  message: string;
  source: DiagnosticSource;
  /** Kod reguły/błędu: `TS2304`, `no-unused-vars`; pusty, gdy narzędzie go nie podało. */
  code: string;
}

export interface DiagnosticsResult {
  items: Diagnostic[];
  errors: number;
  warnings: number;
  /** Narzędzia, które nie wystartowały (brak binarki, błąd konfiguracji). */
  failed: Array<{ source: DiagnosticSource; message: string }>;
}

/** `src/main/index.ts(294,65): error TS2304: Cannot find name 'HookLayer'.` */
const TSC_LINE = /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+([A-Za-z0-9]+):\s+(.*)$/;

function stripRootPrefix(file: string, root: string): string {
  const normalized = file.replace(/\\/g, '/');
  const prefix = `${root.replace(/\\/g, '/').replace(/\/$/, '')}/`;
  return normalized.startsWith(prefix) ? normalized.slice(prefix.length) : normalized;
}

/**
 * Wyjście `tsc --noEmit --pretty false`. Linie kontynuacji (wcięte) należą do
 * poprzedniego błędu — doklejamy je, zamiast gubić albo mnożyć wpisy.
 */
export function parseTscOutput(stdout: string, root = ''): Diagnostic[] {
  const items: Diagnostic[] = [];
  for (const raw of stdout.split('\n')) {
    const line = raw.replace(/\r$/, '');
    if (line.trim() === '') {
      continue;
    }
    const match = TSC_LINE.exec(line);
    if (!match) {
      const previous = items[items.length - 1];
      if (previous && /^\s+/.test(line)) {
        previous.message = `${previous.message} ${line.trim()}`;
      }
      continue;
    }
    const [, file, lineNo, columnNo, severity, code, message] = match;
    items.push({
      file: stripRootPrefix(file ?? '', root),
      line: Number(lineNo),
      column: Number(columnNo),
      severity: severity === 'warning' ? 'warning' : 'error',
      message: message ?? '',
      source: 'tsc',
      code: code ?? '',
    });
  }
  return items;
}

/** Wyjście `eslint --format json`: tablica plików z listą `messages`. */
export function parseEslintJson(stdout: string, root = ''): Diagnostic[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }
  const items: Diagnostic[] = [];
  for (const entry of parsed) {
    if (typeof entry !== 'object' || entry === null) {
      continue;
    }
    const record = entry as { filePath?: unknown; messages?: unknown };
    const file = typeof record.filePath === 'string' ? record.filePath : '';
    if (!Array.isArray(record.messages)) {
      continue;
    }
    for (const raw of record.messages) {
      if (typeof raw !== 'object' || raw === null) {
        continue;
      }
      const message = raw as {
        line?: unknown;
        column?: unknown;
        severity?: unknown;
        message?: unknown;
        ruleId?: unknown;
      };
      items.push({
        file: stripRootPrefix(file, root),
        line: typeof message.line === 'number' ? message.line : 1,
        column: typeof message.column === 'number' ? message.column : 1,
        // ESLint: 2 = błąd, 1 = ostrzeżenie.
        severity: message.severity === 2 ? 'error' : 'warning',
        message: typeof message.message === 'string' ? message.message : '',
        source: 'eslint',
        code: typeof message.ruleId === 'string' ? message.ruleId : '',
      });
    }
  }
  return items;
}

const SEVERITY_ORDER: Record<DiagnosticSeverity, number> = { error: 0, warning: 1 };

/** Błędy przed ostrzeżeniami, dalej po pliku i pozycji — kolejność czytania. */
export function sortDiagnostics(items: readonly Diagnostic[]): Diagnostic[] {
  return [...items].sort((a, b) => {
    if (a.severity !== b.severity) {
      return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    }
    if (a.file !== b.file) {
      return a.file.localeCompare(b.file);
    }
    return a.line === b.line ? a.column - b.column : a.line - b.line;
  });
}

export function summarize(
  items: readonly Diagnostic[],
  failed: DiagnosticsResult['failed'] = [],
): DiagnosticsResult {
  const sorted = sortDiagnostics(items);
  return {
    items: sorted,
    errors: sorted.filter((item) => item.severity === 'error').length,
    warnings: sorted.filter((item) => item.severity === 'warning').length,
    failed,
  };
}

/** Diagnostyki jednego pliku — do podkreśleń w otwartym buforze Monaco. */
export function diagnosticsForFile(
  items: readonly Diagnostic[],
  relativePath: string,
): Diagnostic[] {
  return items.filter((item) => item.file === relativePath);
}
