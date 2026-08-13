import { createWheelNormalizer, type ScrollMetrics } from '../../shared/scroll';

/**
 * Jednolite przewijanie w całym oknie (zgłoszenie użytkowników): kółko myszy
 * przewija stałym krokiem w wierszach, gładzik zostaje natywny. Jeden nasłuch
 * w fazie przechwytywania obsługuje wszystkie kontenery — drzewo plików,
 * panele boczne, karty Ustawień/Historii oraz paski zakładek (tam pionowe
 * kółko przewija w poziomie, bo pasek nie ma innej osi).
 *
 * Wyjątki: terminal (własna obsługa w terminals.ts — przewija bufor xterm,
 * nie DOM), Monaco (własny mechanizm + `mouseWheelScrollSensitivity`) i graf
 * wiedzy (kółko = zoom).
 */

const IGNORED_HOSTS = '.terminal-host, .monaco-editor, .graph-canvas';

const SCROLLABLE_OVERFLOW = new Set(['auto', 'scroll', 'overlay']);

/** Wysokość wiersza treści kontenera — krok jednego kliknięcia kółka. */
function lineHeightOf(style: CSSStyleDeclaration): number {
  const lineHeight = Number.parseFloat(style.lineHeight);
  if (Number.isFinite(lineHeight) && lineHeight > 0) {
    return lineHeight;
  }
  const fontSize = Number.parseFloat(style.fontSize);
  return Number.isFinite(fontSize) && fontSize > 0 ? fontSize * 1.4 : 18;
}

interface ScrollTarget {
  element: HTMLElement;
  axis: 'x' | 'y';
  metrics: ScrollMetrics;
}

/**
 * Najbliższy przodek, który da się jeszcze przewinąć w żądanym kierunku —
 * jak natywne łańcuchowanie przewijania. Pasek zakładek (tylko oś X) łapie
 * pionowe kółko, bo inaczej nie da się go przewinąć bez suwaka.
 */
function scrollTargetFor(start: Element | null, direction: number): ScrollTarget | null {
  let element: Element | null = start;
  while (element && element !== document.documentElement) {
    if (element instanceof HTMLElement) {
      const style = getComputedStyle(element);
      const metrics: ScrollMetrics = {
        lineHeight: lineHeightOf(style),
        viewport: element.clientHeight,
      };
      if (SCROLLABLE_OVERFLOW.has(style.overflowY) && element.scrollHeight - element.clientHeight > 1) {
        const room =
          direction > 0
            ? element.scrollHeight - element.clientHeight - element.scrollTop
            : element.scrollTop;
        if (room > 1) {
          return { element, axis: 'y', metrics };
        }
      } else if (
        SCROLLABLE_OVERFLOW.has(style.overflowX) &&
        element.scrollWidth - element.clientWidth > 1
      ) {
        const room =
          direction > 0
            ? element.scrollWidth - element.clientWidth - element.scrollLeft
            : element.scrollLeft;
        if (room > 1) {
          return { element, axis: 'x', metrics: { ...metrics, viewport: element.clientWidth } };
        }
      }
    }
    element = element.parentElement;
  }
  return null;
}

let installed = false;

export function installWheelScroll(): void {
  if (installed) {
    return;
  }
  installed = true;
  const normalizer = createWheelNormalizer();
  document.addEventListener(
    'wheel',
    (event: WheelEvent) => {
      // Ctrl/⌘ + kółko to powiększanie, poziomy gest gładzika ma własną oś.
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.deltaY === 0 ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ) {
        return;
      }
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(IGNORED_HOSTS)) {
        return;
      }
      const found = scrollTargetFor(target, event.deltaY);
      if (!found) {
        return;
      }
      const { device, pixels } = normalizer.normalize(
        { deltaY: event.deltaY, deltaMode: event.deltaMode, timeStamp: event.timeStamp },
        found.metrics,
      );
      if (device === 'trackpad') {
        // Gładzik ma już tempo palca — natywne przewijanie jest tu lepsze.
        return;
      }
      event.preventDefault();
      if (found.axis === 'y') {
        found.element.scrollTop += pixels;
      } else {
        found.element.scrollLeft += pixels;
      }
    },
    { capture: true, passive: false },
  );
}
