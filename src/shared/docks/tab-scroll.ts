/**
 * Przewijanie paska zakładek — arytmetyka pod strzałki „w lewo / w prawo" (M107).
 * Renderer podaje zmierzone pozycje kart, tu zapada decyzja, którą strzałkę
 * pokazać i jaki sygnał ma nieść. Czysta logika bez DOM — testowana jednostkowo.
 *
 * Dotąd ciasny pasek po prostu ucinał kartę na krawędzi: przewinąć dało się
 * wyłącznie gestem gładzika, a myszą z jednym kółkiem — wcale.
 */

import type { TabKind, TabStatus } from './dock-tabs';

/** Co karta ma do powiedzenia, gdy wyjedzie poza widok — kolory kart z M100. */
export type TabSignal = 'none' | 'done' | 'needs-input' | 'failed';

export interface TabBox {
  /** Lewa krawędź karty względem początku paska (offsetLeft). */
  offset: number;
  width: number;
  signal: TabSignal;
}

export interface TabsOverflow {
  /** Po tej stronie coś zostało za krawędzią — pokazać strzałkę. */
  left: boolean;
  right: boolean;
  /** Najmocniejszy sygnał karty CAŁKOWICIE schowanej po tej stronie. */
  leftSignal: TabSignal;
  rightSignal: TabSignal;
}

export const NO_OVERFLOW: TabsOverflow = {
  left: false,
  right: false,
  leftSignal: 'none',
  rightSignal: 'none',
};

/** Tolerancja na subpiksele (DPI, metryki fontu) — inaczej strzałki migoczą. */
const EPSILON = 1;

/**
 * Pilność sygnałów: pytanie o zgodę wstrzymuje pracę, więc bije martwą sesję,
 * a martwa sesja — skończoną robotę, po którą można sięgnąć kiedykolwiek.
 */
const PILNOSC: Record<TabSignal, number> = {
  none: 0,
  done: 1,
  failed: 2,
  'needs-input': 3,
};

function mocniejszy(a: TabSignal, b: TabSignal): TabSignal {
  return PILNOSC[a] >= PILNOSC[b] ? a : b;
}

/**
 * Sygnał karty — tylko sesje Claude, tak samo jak kolory kart z M100:
 * zwykła powłoka nie ma czego zgłaszać.
 */
export function tabSignal(kind: TabKind, status: TabStatus, failed = false): TabSignal {
  if (kind !== 'claude') {
    return 'none';
  }
  if (failed) {
    return 'failed';
  }
  if (status === 'needs-input') {
    return 'needs-input';
  }
  return status === 'idle' ? 'done' : 'none';
}

export function tabsOverflow(
  boxes: TabBox[],
  scrollLeft: number,
  clientWidth: number,
): TabsOverflow {
  const koniecWidoku = scrollLeft + clientWidth;
  let koniecTresci = 0;
  let leftSignal: TabSignal = 'none';
  let rightSignal: TabSignal = 'none';
  for (const box of boxes) {
    koniecTresci = Math.max(koniecTresci, box.offset + box.width);
    if (box.signal === 'none') {
      continue;
    }
    // Karta widoczna choćby skrajem nie potrzebuje strzałki z sygnałem.
    if (box.offset + box.width <= scrollLeft + EPSILON) {
      leftSignal = mocniejszy(leftSignal, box.signal);
    } else if (box.offset >= koniecWidoku - EPSILON) {
      rightSignal = mocniejszy(rightSignal, box.signal);
    }
  }
  return {
    left: scrollLeft > EPSILON,
    right: koniecTresci > koniecWidoku + EPSILON,
    leftSignal,
    rightSignal,
  };
}

/** Porównanie do pominięcia zbędnego renderu przy każdym zdarzeniu scrolla. */
export function sameOverflow(a: TabsOverflow, b: TabsOverflow): boolean {
  return (
    a.left === b.left &&
    a.right === b.right &&
    a.leftSignal === b.leftSignal &&
    a.rightSignal === b.rightSignal
  );
}

/**
 * Skok jednego kliknięcia strzałki: prawie cały widok, żeby wąski pasek
 * (dok podzielony na panele) nie wymagał dziesięciu kliknięć na kartę.
 */
export function scrollStep(clientWidth: number): number {
  return Math.max(60, clientWidth * 0.7);
}
