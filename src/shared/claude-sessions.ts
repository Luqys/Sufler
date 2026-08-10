/**
 * Wznawianie sesji Claude (M34): czysta logika listy zapisanych sesji.
 * CLI trzyma transkrypty w `~/.claude/projects/<slug>/<uuid>.jsonl`;
 * tytuł budujemy z pierwszej prawdziwej wiadomości użytkownika.
 */

export interface ClaudeSessionEntry {
  /** UUID sesji — argument dla `claude --resume <id>`. */
  id: string;
  title: string;
  /** Czas ostatniej aktywności (mtime pliku transkryptu). */
  mtimeMs: number;
}

/** Slug katalogu projektu — tak Claude Code koduje ścieżkę korzenia. */
export function projectSlug(root: string): string {
  return root.replace(/[^A-Za-z0-9]/g, '-');
}

const TITLE_MAX = 80;

function textFromContent(content: unknown): string | null {
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    for (const block of content) {
      if (
        typeof block === 'object' &&
        block !== null &&
        (block as { type?: unknown }).type === 'text' &&
        typeof (block as { text?: unknown }).text === 'string'
      ) {
        return (block as { text: string }).text;
      }
    }
  }
  return null;
}

/**
 * Tytuł sesji z początkowych linii JSONL — pierwsza wiadomość użytkownika,
 * z pominięciem wpisów meta i opakowań komend lokalnych (`<command-name>`…).
 * Null, gdy w podanym fragmencie nie ma prawdziwej treści (np. po /clear).
 */
export function sessionTitleFromLines(lines: string[]): string | null {
  for (const line of lines) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    if (typeof parsed !== 'object' || parsed === null) {
      continue;
    }
    const entry = parsed as {
      type?: unknown;
      isMeta?: unknown;
      message?: { content?: unknown };
    };
    if (entry.type !== 'user' || entry.isMeta === true) {
      continue;
    }
    const text = textFromContent(entry.message?.content);
    if (text === null) {
      continue;
    }
    const oneLine = text.replace(/\s+/g, ' ').trim();
    if (oneLine === '' || oneLine.startsWith('<')) {
      // Opakowania komend (<command-name>…) i caveaty nie są tytułem.
      continue;
    }
    return oneLine.length > TITLE_MAX ? `${oneLine.slice(0, TITLE_MAX - 1)}…` : oneLine;
  }
  return null;
}

/** Sortowanie od najświeższej + limit — lista ma być menu, nie archiwum. */
export function sortSessions(
  entries: ClaudeSessionEntry[],
  limit = 20,
): ClaudeSessionEntry[] {
  return [...entries].sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, limit);
}
