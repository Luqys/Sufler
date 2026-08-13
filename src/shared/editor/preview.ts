/** Podgląd przeglądarki: typy i czysta logika (testowana jednostkowo). */

export interface PickedElement {
  selector: string;
  tag: string;
  id: string;
  classes: string[];
  text: string;
  url: string;
}

/** Pseudo-ścieżka pierwszej zakładki podglądu w pasku zakładek edytora. */
export const BROWSER_PREVIEW_PATH = 'vn3o://preview';

/**
 * Kolejne podglądy dostają własną ścieżkę. Pasek zakładek deduplikuje po
 * ścieżce, więc dopóki wszystkie podglądy miały tę samą, przycisk „otwórz
 * podgląd" tylko aktywował istniejącą kartę — druga przeglądarka nie
 * powstawała (zgłoszenie użytkowników).
 */
export function browserPreviewPath(index: number): string {
  return index <= 1 ? BROWSER_PREVIEW_PATH : `${BROWSER_PREVIEW_PATH}/${index}`;
}

export function isBrowserPreviewPath(path: string): boolean {
  return path === BROWSER_PREVIEW_PATH || path.startsWith(`${BROWSER_PREVIEW_PATH}/`);
}

/** Numer podglądu ze ścieżki (1 dla pierwszego) — do tytułu i pamięci adresu. */
export function browserPreviewIndex(path: string): number {
  if (path === BROWSER_PREVIEW_PATH) {
    return 1;
  }
  const parsed = Number(path.slice(`${BROWSER_PREVIEW_PATH}/`.length));
  return Number.isInteger(parsed) && parsed > 1 ? parsed : 1;
}

/** Pierwszy wolny numer podglądu wśród już otwartych ścieżek. */
export function nextBrowserPreviewPath(openPaths: Iterable<string>): string {
  const taken = new Set<number>();
  for (const path of openPaths) {
    if (isBrowserPreviewPath(path)) {
      taken.add(browserPreviewIndex(path));
    }
  }
  let index = 1;
  while (taken.has(index)) {
    index += 1;
  }
  return browserPreviewPath(index);
}

/** Pseudo-ścieżka zakładki grafu wiedzy (notatki .md + linki + autorzy). */
export const KNOWLEDGE_GRAPH_PATH = 'vn3o://graph';

/** Karta Ustawień w obszarze edytora (M47). */
export const SETTINGS_PATH = 'vn3o://ustawienia';

/** Karta Samouczka w obszarze edytora (M47). */
export const HELP_PATH = 'vn3o://samouczek';

/** Karta „Problemy" — wyniki tsc/eslint w obszarze edytora (M95). */
export const PROBLEMS_PATH = 'vn3o://problemy';

/** Karta Historii pracy w obszarze edytora (M56). */
export const WORKLOG_PATH = 'vn3o://historia';

export function normalizeUrl(input: string): string {
  const trimmed = input.trim();
  if (trimmed === '') {
    return '';
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `http://${trimmed}`;
}

/** Gotowe zdanie-odniesienie wstawiane do inputu sesji Claude. */
export function formatElementReference(picked: PickedElement): string {
  let tagPart = `<${picked.tag}`;
  if (picked.id) {
    tagPart += ` id="${picked.id}"`;
  }
  if (picked.classes.length > 0) {
    tagPart += ` class="${picked.classes.join(' ')}"`;
  }
  tagPart += '>';
  const parts = [`Element ${tagPart}`];
  if (picked.text) {
    parts.push(`z tekstem „${picked.text}"`);
  }
  parts.push(`— selektor CSS: ${picked.selector}`);
  parts.push(`(strona: ${picked.url})`);
  return `${parts.join(' ')} `;
}
