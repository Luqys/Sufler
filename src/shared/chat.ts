/**
 * Tryb czatu z Claude (Claude Agent SDK — silnik Claude Code jako biblioteka).
 * Typy zdarzeń strumienia i czysta logika składania historii — testowana.
 */

/** Pseudo-ścieżka zakładki czatu w obszarze edytora. */
export const CHAT_PATH = 'vn3o://czat';

export type ChatStreamEvent =
  | { kind: 'user'; text: string }
  | { kind: 'text'; text: string }
  | { kind: 'tool'; name: string; detail: string }
  | { kind: 'done'; sessionId: string; costUsd: number | null }
  | { kind: 'error'; message: string };

export interface ChatEventPayload {
  chatId: string;
  event: ChatStreamEvent;
}

export interface ChatEntry {
  role: 'user' | 'assistant' | 'tool' | 'error';
  text: string;
  /** Nazwa narzędzia (tylko role='tool'). */
  tool?: string;
}

export interface ChatState {
  entries: ChatEntry[];
  /** Claude pracuje nad odpowiedzią (między wysyłką a 'done'/'error'). */
  busy: boolean;
  /** Łączny koszt sesji z ostatniego 'done' (null — nieznany/plan abonamentowy). */
  costUsd: number | null;
}

export const emptyChatState: ChatState = { entries: [], busy: false, costUsd: null };

export function applyChatEvent(state: ChatState, event: ChatStreamEvent): ChatState {
  switch (event.kind) {
    case 'user':
      return {
        ...state,
        busy: true,
        entries: [...state.entries, { role: 'user', text: event.text }],
      };
    case 'text':
      return { ...state, entries: [...state.entries, { role: 'assistant', text: event.text }] };
    case 'tool':
      return {
        ...state,
        entries: [...state.entries, { role: 'tool', text: event.detail, tool: event.name }],
      };
    case 'done':
      return { ...state, busy: false, costUsd: event.costUsd ?? state.costUsd };
    case 'error':
      return {
        ...state,
        busy: false,
        entries: [...state.entries, { role: 'error', text: event.message }],
      };
  }
}

/** Krótki opis wejścia narzędzia do wiersza „użył narzędzia" w historii. */
export function summarizeToolInput(input: unknown): string {
  if (input && typeof input === 'object') {
    const record = input as Record<string, unknown>;
    for (const key of ['file_path', 'path', 'pattern', 'command', 'query', 'url', 'description']) {
      const value = record[key];
      if (typeof value === 'string' && value.trim()) {
        return value.length > 120 ? `${value.slice(0, 119)}…` : value;
      }
    }
  }
  return '';
}
