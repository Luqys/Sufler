import type { DockId } from './dock-tabs';

/**
 * Upuszczenie karty przy krawędzi panelu dzieli dok (M77). Dotąd karta
 * przeciągnięta na panel zawsze do niego wchodziła, a podział szedł wyłącznie
 * przyciskiem — więc „przeciągnij w prawo i miej dwie sesje obok siebie"
 * nie działało.
 *
 * Oś zależy od doku (SPEC.md): dolny dzieli się na kolumny, więc liczy się
 * pozycja w poziomie; prawy na wiersze, więc w pionie. Czysta logika bez DOM —
 * testowana jednostkowo.
 */

export type DropZone = 'center' | 'before' | 'after';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Ile brzegu panelu (w każdą stronę) tworzy strefę podziału. */
export const EDGE_RATIO = 0.25;

/** Poniżej tego rozmiaru panel jest za mały, żeby dzielić go na pół. */
export const MIN_SPLIT_SIZE = 120;

export function dropZoneFor(
  dock: DockId,
  rect: Rect,
  point: Point,
  edgeRatio = EDGE_RATIO,
): DropZone {
  const horizontal = dock === 'bottom';
  const size = horizontal ? rect.width : rect.height;
  if (size < MIN_SPLIT_SIZE) {
    return 'center';
  }
  const offset = horizontal ? point.x - rect.x : point.y - rect.y;
  if (offset < 0 || offset > size) {
    return 'center';
  }
  const edge = size * edgeRatio;
  if (offset <= edge) {
    return 'before';
  }
  if (offset >= size - edge) {
    return 'after';
  }
  return 'center';
}
