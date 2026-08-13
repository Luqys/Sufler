/**
 * Deterministyczny status sesji Claude (M35) — wskaźnik statusu karty:
 * zamiast polegać wyłącznie na heurystyce strumienia pty, karty `claude`
 * dostają wygenerowany plik ustawień (flaga `--settings`) z hookami
 * Notification/Stop, które POST-ują do lokalnego endpointu aplikacji.
 * Czysta logika (budowa ustawień + parsowanie żądania) — testowana jednostkowo.
 */

/** Składnia komendy hooka zależy od powłoki, którą uruchamia Claude Code. */
export type HookPlatform = 'win32' | 'posix';

export type ClaudeHookKind = 'notification' | 'stop' | 'prompt' | 'tool';

export interface ClaudeHookEvent {
  ptyId: number;
  kind: ClaudeHookKind;
  /** Treść polecenia (tylko `prompt`) — karta trzyma ją pod przyciskiem „Kopiuj polecenie". */
  prompt?: string;
}

/** Ścieżka endpointu na serwerze HTTP aplikacji (współdzielonym z ide-ws). */
export const HOOK_ENDPOINT_PATH = '/hook';

function hookCommand(
  port: number,
  token: string,
  event: ClaudeHookKind,
  platform: HookPlatform,
): string {
  const headers =
    ` -H "x-sufler-hook: ${token}"` +
    ` -H "x-sufler-tab: ${platform === 'win32' ? '%VISUALN3O_TAB_ID%' : '$VISUALN3O_TAB_ID'}"` +
    ` -H "x-sufler-event: ${event}"`;
  const target = ` --data-binary @- http://127.0.0.1:${port}${HOOK_ENDPOINT_PATH}`;
  if (platform === 'win32') {
    // Hooki Claude Code na Windowsie idą przez `cmd.exe`: zmienne w procentach,
    // `curl.exe` (jest w Windows 10+), przekierowanie do NUL i `exit /b 0`,
    // żeby brak odpowiedzi nie wyglądał na błąd hooka (M78).
    return `curl.exe -sf -m 3 -X POST${headers}${target} >NUL 2>&1 & exit /b 0`;
  }
  // $VISUALN3O_TAB_ID rozwiązuje shell hooka — zmienna siedzi w env pty karty.
  return `curl -sf -m 3 -X POST${headers}${target} >/dev/null 2>&1 || true`;
}

/**
 * Zawartość pliku dla `claude --settings <plik>` — tylko hooki, nic więcej.
 * Notification/Stop niosą status karty (M35), UserPromptSubmit/PostToolUse
 * zasilają dziennik sesji (M52). Ciało JSON ze stdin trafia do endpointu
 * `--data-binary @-`, bo dziennik potrzebuje session_id i tool_input.
 */
export function buildHookSettings(
  port: number,
  token: string,
  platform: HookPlatform = 'posix',
): object {
  const entry = (event: ClaudeHookKind): object[] => [
    { hooks: [{ type: 'command', command: hookCommand(port, token, event, platform), timeout: 5 }] },
  ];
  return {
    hooks: {
      Notification: entry('notification'),
      Stop: entry('stop'),
      UserPromptSubmit: entry('prompt'),
      PostToolUse: entry('tool'),
    },
  };
}

function headerValue(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') {
    return value;
  }
  return null;
}

/** Walidacja żądania hooka; null → 403. */
export function parseHookRequest(
  headers: Record<string, string | string[] | undefined>,
  expectedToken: string,
): ClaudeHookEvent | null {
  if (expectedToken === '' || headerValue(headers['x-sufler-hook']) !== expectedToken) {
    return null;
  }
  const ptyId = Number(headerValue(headers['x-sufler-tab']));
  if (!Number.isInteger(ptyId) || ptyId <= 0) {
    return null;
  }
  const event = headerValue(headers['x-sufler-event']);
  if (event !== 'notification' && event !== 'stop' && event !== 'prompt' && event !== 'tool') {
    return null;
  }
  return { ptyId, kind: event };
}
