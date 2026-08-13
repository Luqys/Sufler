/**
 * Okna oderwane (M62): karta edytora albo panel boczny wyciągnięty poza okno
 * główne żyje we własnym oknie. Czysta logika adresowania — parametry trasy
 * i walidacja rodzajów, testowana jednostkowo.
 */

/** Panele boczne, które da się wyciągnąć do osobnego okna. */
export const DETACHABLE_PANELS = [
  'files',
  'search',
  'git',
  'sessions',
  'knowledge',
  'skills',
  'mcp',
] as const;
export type DetachablePanel = (typeof DETACHABLE_PANELS)[number];

export type DetachedKind = 'panel' | 'view';

export interface DetachedTarget {
  kind: DetachedKind;
  /** Panel: identyfikator z DETACHABLE_PANELS. Widok: ścieżka karty edytora. */
  target: string;
  title: string;
}

export function isDetachablePanel(value: string): value is DetachablePanel {
  return (DETACHABLE_PANELS as readonly string[]).includes(value);
}

/** Parametry trasy okna oderwanego (query stringi Electrona i dev serwera). */
export function detachedQuery(info: DetachedTarget): Record<string, string> {
  return { window: 'detached', kind: info.kind, target: info.target };
}

/** Odczyt celu z adresu okna; null, gdy to nie jest okno oderwane. */
export function parseDetachedTarget(search: string): DetachedTarget | null {
  const params = new URLSearchParams(search);
  if (params.get('window') !== 'detached') {
    return null;
  }
  const kind = params.get('kind');
  const target = params.get('target');
  if ((kind !== 'panel' && kind !== 'view') || !target) {
    return null;
  }
  if (kind === 'panel' && !isDetachablePanel(target)) {
    return null;
  }
  return { kind, target, title: '' };
}

/**
 * Czy punkt (współrzędne ekranu) leży poza oknem z zapasem. Zapas chroni
 * przed przypadkowym oderwaniem przy upuszczeniu tuż przy krawędzi.
 */
export function isOutsideWindow(
  point: { screenX: number; screenY: number },
  bounds: { screenX: number; screenY: number; outerWidth: number; outerHeight: number },
  margin = 40,
): boolean {
  // Przeglądarka zeruje współrzędne przy anulowanym przeciąganiu — to nie jest
  // upuszczenie poza oknem, tylko brak danych.
  if (point.screenX === 0 && point.screenY === 0) {
    return false;
  }
  return (
    point.screenX < bounds.screenX - margin ||
    point.screenX > bounds.screenX + bounds.outerWidth + margin ||
    point.screenY < bounds.screenY - margin ||
    point.screenY > bounds.screenY + bounds.outerHeight + margin
  );
}
