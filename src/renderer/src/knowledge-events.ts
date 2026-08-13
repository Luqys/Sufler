/**
 * Jedna subskrypcja IPC na życie okna dla zdarzeń Wiedzy (`knowledge:changed`,
 * `wiedza-mcp:changed`); komponenty (graf, panel Wiedzy) dopisują się
 * i wypisują bez wycieku listenerów.
 */

function fanOut(subscribe: (fire: () => void) => void): (listener: () => void) => () => void {
  const listeners = new Set<() => void>();
  let ipcSubscribed = false;
  return (listener: () => void) => {
    if (!ipcSubscribed) {
      ipcSubscribed = true;
      subscribe(() => {
        for (const entry of listeners) {
          entry();
        }
      });
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };
}

export const onKnowledgeChanged = fanOut((fire) => window.api.onKnowledgeChanged(fire));

/** Start/awaria serwera MCP grafu wiedzy — kropka statusu w panelu Wiedza. */
export const onWiedzaMcpChanged = fanOut((fire) => window.api.onWiedzaMcpChanged(fire));
