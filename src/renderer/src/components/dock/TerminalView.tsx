import { useEffect, useRef, type DragEvent, type ReactElement } from 'react';
import { quotePathForPrompt } from '../../../../shared/editor/media';
import { getTerminalInstance } from '../../terminals';

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

  // Upuszczenie pliku (np. obrazka z Findera) wkleja jego ścieżkę do pty.
  const onDragOver = (event: DragEvent<HTMLDivElement>): void => {
    if (event.dataTransfer.types.includes('Files')) {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    }
  };

  const onDrop = (event: DragEvent<HTMLDivElement>): void => {
    const files = Array.from(event.dataTransfer.files);
    if (files.length === 0) {
      return;
    }
    event.preventDefault();
    const instance = getTerminalInstance(tabId);
    if (!instance) {
      return;
    }
    const paths = files.map((file) => window.api.pathForFile(file)).filter(Boolean);
    if (paths.length > 0) {
      instance.term.paste(`${paths.map(quotePathForPrompt).join(' ')} `);
      instance.term.focus();
    }
  };

  return (
    <div
      ref={containerRef}
      className="terminal-view"
      data-testid={`terminal-${tabId}`}
      onDragOver={onDragOver}
      onDrop={onDrop}
    />
  );
}
