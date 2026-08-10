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

    const refit = (): void => {
      if (!instance.host.isConnected || container.clientWidth === 0) {
        return;
      }
      instance.fit.fit();
      window.api.ptyResize(instance.ptyId, instance.term.cols, instance.term.rows);
    };
    refit();
    instance.term.focus();

    const observer = new ResizeObserver(refit);
    observer.observe(container);
    return () => {
      observer.disconnect();
      if (instance.host.parentElement === container) {
        container.removeChild(instance.host);
      }
    };
  }, [tabId]);

  return <div ref={containerRef} className="terminal-view" data-testid={`terminal-${tabId}`} />;
}
