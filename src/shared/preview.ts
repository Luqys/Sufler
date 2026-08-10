/** Podgląd przeglądarki: typy i czysta logika (testowana jednostkowo). */

export interface PickedElement {
  selector: string;
  tag: string;
  id: string;
  classes: string[];
  text: string;
  url: string;
}

/** Pseudo-ścieżka zakładki podglądu w pasku zakładek edytora. */
export const BROWSER_PREVIEW_PATH = 'vn3o://preview';

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
