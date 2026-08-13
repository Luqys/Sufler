/**
 * Sterowanie sesją Claude z paska karty (M83). Wszystko, co da się przełączyć
 * BEZ restartu sesji, idzie komendą ukośnikową wpisaną do pty; tryb uprawnień
 * wyjątkowo klawiszem, bo CLI nie ma dla niego komendy.
 *
 * Zestawy wartości wzięte z `claude --help` wersji 2.1.231 — nie zgadywane:
 *   --effort (low, medium, high, xhigh, max)
 *   --permission-mode (acceptEdits, auto, bypassPermissions, manual, dontAsk, plan)
 * Komendy `/model`, `/effort`, `/compact`, `/clear`, `/mcp`, `/login` sprawdzone
 * w binarce CLI. Czysta logika — testowana jednostkowo.
 */

export type ClaudeModel = 'opus' | 'sonnet' | 'haiku';
export type ClaudeEffort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/** Cykl trybów uprawnień pod shift+tab — kolejność jak w CLI. */
export const PERMISSION_CYCLE = ['manual', 'auto', 'plan'] as const;

/**
 * Shift+Tab w kodowaniu terminala (CSI Z). Tryb uprawnień nie ma komendy
 * ukośnikowej — CLI przełącza go wyłącznie tym klawiszem, cyklicznie.
 */
export const SHIFT_TAB = '\u001b[Z';

/** Enter dla pty: sam CR, bez LF (tak wysyła terminal). */
const ENTER = '\r';

/**
 * Polecenie do wpisania w sesji. Zwracamy gotowy ciąg bajtów dla pty —
 * komenda plus Enter, bo bez niego wpis zawisłby w polu wejściowym.
 */
export function slashCommand(command: string, argument?: string): string {
  const trimmed = argument?.trim();
  return `/${command}${trimmed ? ` ${trimmed}` : ''}${ENTER}`;
}

export function modelCommand(model: ClaudeModel): string {
  return slashCommand('model', model);
}

export function effortCommand(effort: ClaudeEffort): string {
  return slashCommand('effort', effort);
}

/**
 * Prompt przekazania pracy nowej sesji (M83). Sesja startuje pusta, więc
 * kontekst przenosi DZIENNIK: nowa sesja ma go przeczytać, zanim ruszy dalej.
 * `@ścieżka` to składnia CLI na wciągnięcie pliku do kontekstu.
 */
export function handoverPrompt(logPath: string, summary: string | null): string {
  const wstep =
    'Przejmujesz pracę z poprzedniej sesji — kontekst masz w dzienniku, nie w tej rozmowie.';
  const plik = `Przeczytaj @${logPath} (na górze pliku jest streszczenie: co zrobione, co dalej).`;
  const zadanie =
    'Streść mi w trzech zdaniach, na czym stanęliśmy, i czekaj na moje następne polecenie — nie zaczynaj pracy sam.';
  const kontekst = summary ? `\n\nStreszczenie poprzedniej sesji:\n${summary.trim()}` : '';
  return `${wstep} ${plik} ${zadanie}${kontekst}`;
}

export interface HandoverPlan {
  /** Dziennik sesji, z którego nowa sesja odtworzy kontekst. */
  logPath: string;
  prompt: string;
}

/**
 * Wybór dziennika do przekazania: najświeższy plik sesji projektu. Null, gdy
 * dziennik jest wyłączony albo sesja nie zdążyła nic zapisać — wtedy nie ma
 * czego przenosić i przycisk musi to powiedzieć wprost, a nie otwierać pustej
 * sesji z obietnicą kontekstu.
 */
export function planHandover(
  logs: Array<{ path: string; mtimeMs: number }>,
  summary: string | null = null,
): HandoverPlan | null {
  const najnowszy = [...logs].sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  if (!najnowszy) {
    return null;
  }
  return { logPath: najnowszy.path, prompt: handoverPrompt(najnowszy.path, summary) };
}
