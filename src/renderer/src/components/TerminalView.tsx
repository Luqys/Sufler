import { useEffect, useRef, type ReactElement } from 'react';
import { getTerminalInstance } from '../terminals';

/**
 * Montuje istniejący host xterm w bieżącym doku. Odmontowanie NIE niszczy
 * instancji — to podstawa przenoszenia zakładek między dokami bez utraty
 * scrollbacku i procesu.
 */
export function TerminalView({ tabId }: { tabId: string }): ReactElement {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const instance = getTerminalInstance(tabId);
    if (!container || !instance) {
      return;
    }
    container.appendChild(instance.host);

    let raf = 0;
    let corrected = false;

    const measure = (): void => {
      raf = 0;
      if (!instance.host.isConnected || container.clientWidth === 0) {
        return;
      }
      instance.fit.fit();
      window.api.ptyResize(instance.ptyId, instance.term.cols, instance.term.rows);
      // Pomiar ze świeżymi metrykami fontu (dociągnięty font, inne DPI) bywa
      // o ułamek celi za szeroki i tnie prawą krawędź — jedna korekta w
      // kolejnej klatce, gdy render nadal wystaje poza kontener.
      if (!corrected && instance.host.scrollWidth > instance.host.clientWidth) {
        corrected = true;
        raf = requestAnimationFrame(measure);
      }
    };

    // Pomiar po ułożeniu layoutu (rAF) — scala też serie zdarzeń w jeden fit.
    const refit = (): void => {
      corrected = false;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    };

    refit();
    instance.term.focus();

    const observer = new ResizeObserver(refit);
    observer.observe(container);
    window.addEventListener('resize', refit);
    // Metryki 'SF Mono'/Menlo potrafią się doliczyć po pierwszym fit.
    void document.fonts.ready.then(refit);

    // Przenosiny okna między ekranami zmieniają DPI bez zmiany rozmiaru
    // elementu — ResizeObserver tego nie zauważa.
    let dpiQuery: MediaQueryList | null = null;
    const onDpiChange = (): void => {
      refit();
      watchDpi();
    };
    const watchDpi = (): void => {
      dpiQuery?.removeEventListener('change', onDpiChange);
      dpiQuery = matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      dpiQuery.addEventListener('change', onDpiChange);
    };
    watchDpi();

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener('resize', refit);
      dpiQuery?.removeEventListener('change', onDpiChange);
      if (instance.host.parentElement === container) {
        container.removeChild(instance.host);
      }
    };
  }, [tabId]);

  return <div ref={containerRef} className="terminal-view" data-testid={`terminal-${tabId}`} />;
}
