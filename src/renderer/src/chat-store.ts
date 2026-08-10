import {
  applyChatEvent,
  emptyChatState,
  type ChatState,
} from '../../shared/chat';

/**
 * Stan czatu poza Reactem (jak terminals.ts): przeżywa zamknięcie zakładki,
 * a subskrypcja IPC jest jedna na życie okna.
 */

let state: ChatState = emptyChatState;
const listeners = new Set<() => void>();

function setState(next: ChatState): void {
  state = next;
  for (const listener of listeners) {
    listener();
  }
}

let ipcSubscribed = false;
function ensureIpcSubscription(): void {
  if (!ipcSubscribed) {
    ipcSubscribed = true;
    window.api.onChatEvent(({ event }) => setState(applyChatEvent(state, event)));
  }
}

export function getChatState(): ChatState {
  return state;
}

export function subscribeChat(listener: () => void): () => void {
  ensureIpcSubscription();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function sendChat(root: string, text: string): void {
  setState(applyChatEvent(state, { kind: 'user', text }));
  // Błędy wracają zdarzeniem 'error' ze strony main — wynik invoke jest zbędny.
  void window.api.chatSend(root, text);
}

export function interruptChat(): void {
  void window.api.chatInterrupt();
}

export function resetChat(): void {
  setState(emptyChatState);
  void window.api.chatReset();
}
