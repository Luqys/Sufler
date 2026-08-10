import { FitAddon } from '@xterm/addon-fit';
import { SerializeAddon } from '@xterm/addon-serialize';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';

/**
 * Rejestr instancji xterm poza drzewem Reacta. Przenoszenie zakładki między
 * dokami przenosi TEN SAM element DOM (host), więc scrollback i proces
 * zostają nietknięte — zmienia się tylko, który dok renderuje dany ptyId.
 */

export interface TerminalInstance {
  term: Terminal;
  fit: FitAddon;
  serialize: SerializeAddon;
  host: HTMLDivElement;
  ptyId: number;
  /** Dodatkowy odbiorca surowego wyjścia pty (np. heurystyka statusu Claude). */
  onOutput?: (chunk: string) => void;
}

const instances = new Map<string, TerminalInstance>();
const byPtyId = new Map<number, TerminalInstance>();
/** Dane, które przyszły zanim powstała instancja (wyścig create→subskrypcja). */
const pendingOutput = new Map<number, string[]>();

const darkMedia = window.matchMedia('(prefers-color-scheme: dark)');

function themeFor(dark: boolean): { background: string; foreground: string; cursor: string } {
  return dark
    ? { background: '#1b1c21', foreground: '#e8e8ea', cursor: '#d97757' }
    : { background: '#ffffff', foreground: '#1d1d1f', cursor: '#c15f3c' };
}

darkMedia.addEventListener('change', () => {
  for (const instance of instances.values()) {
    instance.term.options.theme = themeFor(darkMedia.matches);
  }
});

// Jedna globalna subskrypcja na życie okna; routing po ptyId.
window.api.onPtyData(({ ptyId, data }) => {
  const instance = byPtyId.get(ptyId);
  if (instance) {
    instance.term.write(data);
    instance.onOutput?.(data);
  } else {
    // Dane lecą do wszystkich okien — bufor obcych pty trzymamy z limitem.
    const pending = pendingOutput.get(ptyId) ?? [];
    pending.push(data);
    if (pending.length > 300) {
      pending.shift();
    }
    pendingOutput.set(ptyId, pending);
  }
});

window.api.onPtyExit(({ ptyId }) => {
  pendingOutput.delete(ptyId);
  const instance = byPtyId.get(ptyId);
  instance?.term.write('\r\n\x1b[2m[proces zakończony]\x1b[0m\r\n');
});

export function createTerminalInstance(
  tabId: string,
  ptyId: number,
  onOutput?: (chunk: string) => void,
): TerminalInstance {
  const host = document.createElement('div');
  host.className = 'terminal-host';
  const term = new Terminal({
    fontFamily: "'SF Mono', Menlo, Monaco, monospace",
    fontSize: 12.5,
    cursorBlink: true,
    scrollback: 10_000,
    theme: themeFor(darkMedia.matches),
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  const serialize = new SerializeAddon();
  term.loadAddon(serialize);
  term.open(host);
  term.onData((data) => window.api.ptyWrite(ptyId, data));
  const instance: TerminalInstance = { term, fit, serialize, host, ptyId, onOutput };
  instances.set(tabId, instance);
  byPtyId.set(ptyId, instance);
  const pending = pendingOutput.get(ptyId);
  if (pending) {
    pendingOutput.delete(ptyId);
    for (const chunk of pending) {
      term.write(chunk);
      onOutput?.(chunk);
    }
  }
  return instance;
}

export function getTerminalInstance(tabId: string): TerminalInstance | null {
  return instances.get(tabId) ?? null;
}

/** Zserializowany bufor terminala (scrollback) — do przenosin między oknami. */
export function serializeTerminal(tabId: string): string | null {
  const instance = instances.get(tabId);
  if (!instance) {
    return null;
  }
  try {
    return instance.serialize.serialize({ scrollback: 2000 });
  } catch {
    return null;
  }
}

export function disposeTerminalInstance(tabId: string): void {
  const instance = instances.get(tabId);
  if (!instance) {
    return;
  }
  instances.delete(tabId);
  byPtyId.delete(instance.ptyId);
  pendingOutput.delete(instance.ptyId);
  instance.term.dispose();
  instance.host.remove();
}
