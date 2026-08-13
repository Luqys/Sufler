import { FitAddon } from '@xterm/addon-fit';
import { SerializeAddon } from '@xterm/addon-serialize';
import { Terminal, type ITheme } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import type { TabKind } from '../../shared/docks/dock-tabs';
import { quotePathForPrompt } from '../../shared/editor/media';
import { createWheelNormalizer } from '../../shared/system/scroll';
import { CLAUDE_NEWLINE, isClaudeNewline } from '../../shared/claude/terminal-keys';
import { FLAVOR_EVENT, isDarkTheme, isMatrixFlavor } from './appearance-client';
import { t } from './i18n';

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

export interface CreateTerminalOptions {
  /** Rodzaj karty — `claude` dostaje Shift+Enter jako nową linię. */
  kind?: TabKind;
  onOutput?: (chunk: string) => void;
}

const instances = new Map<string, TerminalInstance>();
const byPtyId = new Map<number, TerminalInstance>();
/** Dane, które przyszły zanim powstała instancja (wyścig create→subskrypcja). */
const pendingOutput = new Map<number, string[]>();

function themeFor(dark: boolean): ITheme {
  return dark
    ? {
        background: '#1b1c21',
        foreground: '#e8e8ea',
        cursor: '#d97757',
        selectionBackground: '#3a3f4b',
        black: '#2e2e33',
        red: '#e5484d',
        green: '#46a758',
        yellow: '#d5a021',
        blue: '#4f8ff7',
        magenta: '#b78af5',
        cyan: '#3fb8c9',
        white: '#b8b8bd',
        brightBlack: '#6e6e76',
        brightRed: '#f2555a',
        brightGreen: '#55b467',
        brightYellow: '#e2b03a',
        brightBlue: '#6ba2f9',
        brightMagenta: '#c79bf7',
        brightCyan: '#58c6d6',
        brightWhite: '#e8e8ea',
      }
    : {
        background: '#ffffff',
        foreground: '#1d1d1f',
        cursor: '#c15f3c',
        selectionBackground: '#d6dcf5',
        black: '#3a3a3e',
        red: '#c0392b',
        green: '#227d4a',
        yellow: '#96650a',
        blue: '#1f5fbf',
        magenta: '#8e44ad',
        cyan: '#0e7490',
        white: '#8e8e93',
        brightBlack: '#6e6e73',
        brightRed: '#d54c3c',
        brightGreen: '#2e9e5b',
        brightYellow: '#a8790f',
        brightBlue: '#3b76d6',
        brightMagenta: '#9d5bbf',
        brightCyan: '#0d84a3',
        brightWhite: '#1d1d1f',
      };
}

/** Motyw matrixowy: fosforyczna zieleń na czerni; czerwień zostaje dla błędów. */
const MATRIX_THEME: ITheme = {
  background: '#050b06',
  foreground: '#7dff9b',
  cursor: '#00e653',
  selectionBackground: '#134d26',
  black: '#0c1a0e',
  red: '#ff6b60',
  green: '#2fe66b',
  yellow: '#b8e63e',
  blue: '#2fd9a8',
  magenta: '#66ffc2',
  cyan: '#3ee6d2',
  white: '#a8d9b0',
  brightBlack: '#3f7a50',
  brightRed: '#ff8a80',
  brightGreen: '#5cff8f',
  brightYellow: '#d2ff66',
  brightBlue: '#4dffc4',
  brightMagenta: '#8affd2',
  brightCyan: '#66ffe9',
  brightWhite: '#d9ffe0',
};

function currentTheme(): ITheme {
  return isMatrixFlavor() ? MATRIX_THEME : themeFor(isDarkTheme());
}

function rethemeAll(): void {
  for (const instance of instances.values()) {
    instance.term.options.theme = currentTheme();
  }
}

window.addEventListener(FLAVOR_EVENT, rethemeAll);

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
  instance?.term.write(`\r\n\x1b[2m${t('terminal.exited')}\x1b[0m\r\n`);
});

export function createTerminalInstance(
  tabId: string,
  ptyId: number,
  options: CreateTerminalOptions = {},
): TerminalInstance {
  const { kind = 'terminal', onOutput } = options;
  const host = document.createElement('div');
  host.className = 'terminal-host';
  const term = new Terminal({
    fontFamily: "'SF Mono', Menlo, Monaco, monospace",
    fontSize: 12.5,
    cursorBlink: true,
    scrollback: 10_000,
    theme: currentTheme(),
    // Programy zakładające ciemne tło (np. Claude Code) wypisują jasnoszare
    // kolory 256/truecolor, nieczytelne na białym — xterm dociąga je do kontrastu.
    minimumContrastRatio: 4.5,
  });
  const fit = new FitAddon();
  term.loadAddon(fit);
  const serialize = new SerializeAddon();
  term.loadAddon(serialize);
  term.open(host);
  term.onData((data) => window.api.ptyWrite(ptyId, data));
  if (kind === 'claude') {
    // Shift+Enter = nowa linia w poleceniu. W zwykłym terminalu zostawiamy
    // domyślne zachowanie (Shift+Enter zatwierdza), bo powłoka nie zna ESC+CR.
    term.attachCustomKeyEventHandler((event) => {
      if (isClaudeNewline(event)) {
        window.api.ptyWrite(ptyId, CLAUDE_NEWLINE);
        return false;
      }
      return true;
    });
  }
  // Wklejenie obrazka (np. zrzutu ekranu): schowek ma bitmapę bez tekstu —
  // zapisujemy ją do pliku i wklejamy ścieżkę (Claude Code czyta obrazki po
  // ścieżce). Nasłuch w fazie capture wyprzedza własny handler xterm.
  host.addEventListener(
    'paste',
    (event) => {
      const data = event.clipboardData;
      if (!data) {
        return;
      }
      const hasText = data.types.includes('text/plain');
      const hasImage = Array.from(data.items).some((item) => item.type.startsWith('image/'));
      if (hasImage && !hasText) {
        event.preventDefault();
        event.stopPropagation();
        void window.api.saveClipboardImage().then((saved) => {
          if (saved.ok) {
            term.paste(`${quotePathForPrompt(saved.path)} `);
          }
        });
      }
    },
    true,
  );
  // Kółko myszy: xterm dzieli grubą deltę (~100 px) przez wysokość celi, więc
  // jedno kliknięcie skakało o ~6 wierszy, a gładzik sunął po jednym. Stały
  // krok w wierszach zrównuje tempo; gładzik zostaje pod natywną obsługą
  // xterma. stopPropagation w fazie przechwytywania — inaczej xterm przewinąłby
  // bufor po raz drugi.
  const wheelNormalizer = createWheelNormalizer();
  host.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey || event.metaKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        return;
      }
      const rowsElement = host.querySelector<HTMLElement>('.xterm-rows');
      const lineHeight =
        rowsElement && term.rows > 0 ? rowsElement.clientHeight / term.rows : 17;
      const { device, lines } = wheelNormalizer.normalize(
        { deltaY: event.deltaY, deltaMode: event.deltaMode, timeStamp: event.timeStamp },
        { lineHeight, viewport: host.clientHeight },
      );
      if (device === 'trackpad') {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      term.scrollLines(lines < 0 ? Math.floor(lines) : Math.ceil(lines));
    },
    { capture: true, passive: false },
  );
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
