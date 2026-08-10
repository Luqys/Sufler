/**
 * Jedna subskrypcja IPC `knowledge:changed` na życie okna; komponenty
 * (graf, panel Wiedzy) dopisują się i wypisują bez wycieku listenerów.
 */

const listeners = new Set<() => void>();
let ipcSubscribed = false;

export function onKnowledgeChanged(listener: () => void): () => void {
  if (!ipcSubscribed) {
    ipcSubscribed = true;
    window.api.onKnowledgeChanged(() => {
      for (const entry of listeners) {
        entry();
      }
    });
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
