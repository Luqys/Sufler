/**
 * Sesje Claude: czysta logika czytania zapisanych transkryptów.
 * CLI trzyma je w `~/.claude/projects/<slug>/<uuid>.jsonl`; tytuł budujemy
 * z pierwszej prawdziwej wiadomości użytkownika (M34), a panel „Sesje"
 * dokłada metryki i podgląd ostatnich wymian (M67).
 */

export interface ClaudeSessionEntry {
  /** UUID sesji — argument dla `claude --resume <id>`. */
  id: string;
  title: string;
  /** Czas ostatniej aktywności (mtime pliku transkryptu). */
  mtimeMs: number;
}

/** Wpis panelu „Sesje"; menu wznawiania w doku korzysta z węższego kształtu. */
export interface ClaudeSessionSummary extends ClaudeSessionEntry {
  /** Czas pierwszego wpisu transkryptu; 0, gdy żaden nie ma znacznika. */
  startedMs: number;
  /** Gałąź git z czasu rozmowy; pusty string, gdy transkrypt jej nie zna. */
  branch: string;
  /** Rozmiar transkryptu w bajtach — z grubsza długość rozmowy. */
  sizeBytes: number;
}

export interface ClaudeSessionMessage {
  role: 'user' | 'assistant';
  text: string;
  /** 0, gdy wpis nie miał znacznika czasu. */
  timestampMs: number;
}

/** Rozliczenie całego transkryptu — do rozwiniętego wiersza w panelu. */
export interface ClaudeSessionDetails {
  userMessages: number;
  assistantMessages: number;
  /** Ile razy Claude sięgnął po narzędzie (Edit, Bash, …). */
  toolCalls: number;
  startedMs: number;
  endedMs: number;
  /** Ostatnie wymiany, od najstarszej — podgląd, nie pełny transkrypt. */
  messages: ClaudeSessionMessage[];
  /** true, gdy przed podglądem były jeszcze inne wiadomości. */
  truncated: boolean;
}

/** Slug katalogu projektu — tak Claude Code koduje ścieżkę korzenia. */
export function projectSlug(root: string): string {
  return root.replace(/[^A-Za-z0-9]/g, '-');
}

const TITLE_MAX = 80;
/** Podgląd wiadomości ma dać pojęcie o wątku, a nie odtworzyć rozmowę. */
const PREVIEW_TEXT_MAX = 320;

function shorten(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Tekst wiadomości: goły string albo sklejone bloki `text` z tablicy. */
function textFromContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  if (!Array.isArray(content)) {
    return '';
  }
  const parts: string[] = [];
  for (const block of content) {
    if (typeof block !== 'object' || block === null) {
      continue;
    }
    const typed = block as { type?: unknown; text?: unknown };
    if (typed.type === 'text' && typeof typed.text === 'string') {
      parts.push(typed.text);
    }
  }
  return parts.join(' ');
}

/** Ile bloków `tool_use` niesie wiadomość — miara „ile Claude narobił". */
function countToolUses(content: unknown): number {
  if (!Array.isArray(content)) {
    return 0;
  }
  let count = 0;
  for (const block of content) {
    if (
      typeof block === 'object' &&
      block !== null &&
      (block as { type?: unknown }).type === 'tool_use'
    ) {
      count += 1;
    }
  }
  return count;
}

/**
 * Treść nadająca się do pokazania człowiekowi: bez wpisów meta, opakowań
 * komend lokalnych (`<command-name>`…) i wyników narzędzi. Pusty string
 * oznacza wpis, którego nie warto pokazywać.
 */
function displayText(content: unknown): string {
  const oneLine = textFromContent(content).replace(/\s+/g, ' ').trim();
  return oneLine.startsWith('<') ? '' : oneLine;
}

interface TranscriptEntry {
  type?: unknown;
  isMeta?: unknown;
  isSidechain?: unknown;
  timestamp?: unknown;
  gitBranch?: unknown;
  message?: { content?: unknown };
}

function parseEntry(line: string): TranscriptEntry | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    // Ostatnia linia bywa ucięta w pół (czytamy początek pliku) — pomijamy.
    return null;
  }
  return typeof parsed === 'object' && parsed !== null ? (parsed as TranscriptEntry) : null;
}

function timestampOf(entry: TranscriptEntry): number {
  if (typeof entry.timestamp !== 'string') {
    return 0;
  }
  const parsed = Date.parse(entry.timestamp);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export interface SessionScan {
  /** Null, gdy w transkrypcie nie ma żadnej prawdziwej wiadomości (np. po /clear). */
  title: string | null;
  startedMs: number;
  endedMs: number;
  branch: string;
  userMessages: number;
  assistantMessages: number;
  toolCalls: number;
  messages: ClaudeSessionMessage[];
  truncated: boolean;
}

export interface SessionScanner {
  push(line: string): void;
  result(): SessionScan;
}

/**
 * Skaner transkryptu karmiony linia po linii — transkrypty sięgają
 * dziesiątek megabajtów, więc proces główny strumieniuje je zamiast
 * wczytywać w całości. `previewCount` = ile ostatnich wymian zachować.
 */
export function createSessionScanner(previewCount = 0): SessionScanner {
  let title: string | null = null;
  let startedMs = 0;
  let endedMs = 0;
  let branch = '';
  let userMessages = 0;
  let assistantMessages = 0;
  let toolCalls = 0;
  let seenMessages = 0;
  const messages: ClaudeSessionMessage[] = [];

  const push = (line: string): void => {
    const entry = parseEntry(line);
    if (entry === null) {
      return;
    }
    const isUser = entry.type === 'user';
    const isAssistant = entry.type === 'assistant';
    if (!isUser && !isAssistant) {
      return;
    }
    // Wpisy meta i ruch subagentów to nie jest rozmowa, którą prowadził człowiek.
    if (entry.isMeta === true || entry.isSidechain === true) {
      return;
    }
    if (branch === '' && typeof entry.gitBranch === 'string' && entry.gitBranch !== '') {
      branch = entry.gitBranch;
    }
    const stamp = timestampOf(entry);
    if (stamp > 0) {
      if (startedMs === 0) {
        startedMs = stamp;
      }
      endedMs = stamp;
    }
    toolCalls += countToolUses(entry.message?.content);
    const text = displayText(entry.message?.content);
    if (text === '') {
      return;
    }
    if (isUser) {
      userMessages += 1;
      if (title === null) {
        title = shorten(text, TITLE_MAX);
      }
    } else {
      assistantMessages += 1;
    }
    if (previewCount > 0) {
      seenMessages += 1;
      messages.push({
        role: isUser ? 'user' : 'assistant',
        text: shorten(text, PREVIEW_TEXT_MAX),
        timestampMs: stamp,
      });
      if (messages.length > previewCount) {
        messages.shift();
      }
    }
  };

  return {
    push,
    result: () => ({
      title,
      startedMs,
      endedMs,
      branch,
      userMessages,
      assistantMessages,
      toolCalls,
      messages,
      truncated: seenMessages > messages.length,
    }),
  };
}

/** Wygodne opakowanie skanera dla gotowej tablicy linii. */
export function scanSessionLines(lines: string[], previewCount = 0): SessionScan {
  const scanner = createSessionScanner(previewCount);
  for (const line of lines) {
    scanner.push(line);
  }
  return scanner.result();
}

/**
 * Tytuł sesji z początkowych linii JSONL — pierwsza wiadomość użytkownika,
 * z pominięciem wpisów meta i opakowań komend lokalnych (`<command-name>`…).
 * Null, gdy w podanym fragmencie nie ma prawdziwej treści (np. po /clear).
 */
export function sessionTitleFromLines(lines: string[]): string | null {
  return scanSessionLines(lines).title;
}

/**
 * Etykieta sesji do wyświetlenia (M77). Pierwsze polecenie często zaczyna się
 * od wklejonej ścieżki (zrzut ekranu, plik), więc lista sesji pokazywała rzędy
 * nieczytelnych `'/var/folders/g4/czjdmg…`. Ścieżki z początku wypadają, zostaje
 * treść polecenia; gdy polecenie było SAMĄ ścieżką, zostaje jej ostatni
 * element. Czysta logika — testowana jednostkowo.
 */
export function sessionLabel(title: string): string {
  const collapse = (text: string): string => text.replace(/\s+/g, ' ').trim();
  let rest = collapse(title);
  let lastPath: string | null = null;
  // Ścieżki w apostrofach/cudzysłowach oraz gołe ścieżki bez spacji.
  const leading = /^(?:'([^']*\/[^']*)'|"([^"]*\/[^"]*)"|(\/\S*\/\S*))\s*/;
  let match = leading.exec(rest);
  while (match) {
    lastPath = match[1] ?? match[2] ?? match[3] ?? lastPath;
    rest = rest.slice(match[0].length).trim();
    match = leading.exec(rest);
  }
  if (rest !== '') {
    return rest;
  }
  if (lastPath) {
    const segments = lastPath.split('/').filter((segment) => segment !== '');
    return segments[segments.length - 1] ?? lastPath;
  }
  return collapse(title);
}

/** Sortowanie od najświeższej + limit — lista ma być menu, nie archiwum. */
export function sortSessions<T extends ClaudeSessionEntry>(entries: T[], limit = 20): T[] {
  return [...entries].sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, limit);
}
