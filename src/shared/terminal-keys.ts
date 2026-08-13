/**
 * Klawisze, które w kartach `claude` znaczą co innego niż w powłoce.
 * Czysta logika — testowana jednostkowo.
 */

/**
 * Nowa linia w poleceniu Claude Code: CLI czyta ESC+CR (dokładnie to wiązanie
 * zakłada `claude /terminal-setup` w iTermie i VS Code). Bez tego xterm wysyła
 * na Shift+Enter zwykły CR, więc polecenie leci od razu w świat, zamiast
 * złamać się na dwie linie (zgłoszenie użytkowników).
 */
export const CLAUDE_NEWLINE = '\x1b\r';

export interface KeyStroke {
  type: string;
  key: string;
  shiftKey: boolean;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

/** Czy ten klawisz to „nowa linia w poleceniu" (Shift+Enter bez innych modyfikatorów). */
export function isClaudeNewline(event: KeyStroke): boolean {
  return (
    event.type === 'keydown' &&
    event.key === 'Enter' &&
    event.shiftKey &&
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey
  );
}
