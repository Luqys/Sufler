/**
 * Dziennik sesji Claude (M52): hooki UserPromptSubmit/PostToolUse/Stop
 * dopisują zwięzły plik .md z przebiegiem pracy. To odpowiedź na rozdmuchany
 * kontekst — po `/clear` dziennik przywraca wątek w kilkunastu linijkach
 * zamiast całego transkryptu, a jako notatka .md wchodzi do panelu Wiedza
 * i grafu. Czysta logika (parsowanie ciała hooka, budowa wpisów) — testowana
 * jednostkowo.
 */

export const SESSION_LOG_DIR = 'dziennik-sesji';

/** Zdarzenia hooka, które trafiają do dziennika. */
export type SessionLogKind = 'prompt' | 'tool' | 'stop';

export interface SessionLogEvent {
  kind: SessionLogKind;
  sessionId: string;
  /** Treść promptu (UserPromptSubmit). */
  prompt?: string;
  /** Nazwa narzędzia (PostToolUse). */
  toolName?: string;
  /** Ścieżka pliku z tool_input, jeśli narzędzie jej użyło. */
  filePath?: string;
  /** Komenda powłoki z tool_input (Bash). */
  command?: string;
}

/**
 * Narzędzia warte odnotowania: te, które zmieniają projekt albo uruchamiają
 * procesy. Read/Grep/Glob pomijamy — zaśmieciłyby dziennik i podniosły koszt
 * jego czytania, a niczego nie mówią o postępie pracy.
 */
const LOGGED_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'Bash']);

function firstString(value: unknown, keys: string[]): string | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === 'string' && candidate.trim() !== '') {
      return candidate;
    }
  }
  return undefined;
}

/** Skraca tekst do jednej linii o zadanej długości (dziennik ma być zwięzły). */
export function condense(text: string, limit = 180): string {
  const single = text.replace(/\s+/g, ' ').trim();
  return single.length <= limit ? single : `${single.slice(0, limit - 1)}…`;
}

/** Ciało hooka (JSON ze stdin) → zdarzenie dziennika; null gdy nieistotne. */
export function parseSessionLogPayload(kind: SessionLogKind, raw: string): SessionLogEvent | null {
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof payload !== 'object' || payload === null) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const sessionId = typeof record['session_id'] === 'string' ? record['session_id'] : '';
  if (sessionId === '') {
    return null;
  }
  if (kind === 'prompt') {
    const prompt = typeof record['prompt'] === 'string' ? record['prompt'].trim() : '';
    return prompt === '' ? null : { kind, sessionId, prompt };
  }
  if (kind === 'stop') {
    return { kind, sessionId };
  }
  const toolName = typeof record['tool_name'] === 'string' ? record['tool_name'] : '';
  if (!LOGGED_TOOLS.has(toolName)) {
    return null;
  }
  const input = record['tool_input'];
  return {
    kind,
    sessionId,
    toolName,
    filePath: firstString(input, ['file_path', 'notebook_path', 'path']),
    command: firstString(input, ['command']),
  };
}

/** Nazwa pliku dziennika: data + skrócony identyfikator sesji. */
export function sessionLogFile(sessionId: string, isoDate: string): string {
  const day = isoDate.slice(0, 10);
  const short = sessionId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8) || 'sesja';
  return `${SESSION_LOG_DIR}/${day}-${short}.md`;
}

/** Nagłówek nowego dziennika — frontmatter wpina go w graf wiedzy. */
export function buildSessionLogHeader(options: {
  sessionId: string;
  isoDate: string;
  project: string;
  branch?: string | null;
}): string {
  const lines = [
    '---',
    'kategoria: Dziennik sesji',
    'tagi: [dziennik, claude]',
    `sesja: ${options.sessionId}`,
    `data: ${options.isoDate}`,
    '---',
    '',
    `# Dziennik sesji — ${options.project}`,
    '',
    `Start: ${options.isoDate}${options.branch ? ` · gałąź \`${options.branch}\`` : ''}`,
    '',
    'Zapis prowadzony automatycznie przez Sufler (hooki Claude Code). Po `/clear`',
    'wczytaj ten plik, aby wrócić do wątku bez odtwarzania całej rozmowy.',
    '',
  ];
  return `${lines.join('\n')}\n`;
}

/** Pojedynczy wpis dziennika; null, gdy zdarzenie nie wnosi nic nowego. */
export function buildSessionLogEntry(event: SessionLogEvent, time: string): string | null {
  if (event.kind === 'prompt') {
    return `\n## ${time} — polecenie\n\n${condense(event.prompt ?? '', 400)}\n`;
  }
  if (event.kind === 'stop') {
    return `\n_${time} — Claude zakończył turę._\n`;
  }
  if (event.toolName === 'Bash') {
    return event.command ? `- \`${time}\` powłoka: \`${condense(event.command, 160)}\`\n` : null;
  }
  if (!event.filePath) {
    return null;
  }
  const verb = event.toolName === 'Write' ? 'zapis' : 'edycja';
  return `- \`${time}\` ${verb}: \`${event.filePath}\`\n`;
}
