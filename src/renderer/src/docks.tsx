import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { createClaudeStatusTracker } from '../../shared/claude/claude-status';
import {
  activateTab as activateTabState,
  activeTabs,
  addTab as addTabState,
  allTabs,
  closeTab as closeTabState,
  emptyDocksState,
  findTab,
  insertPaneAfter as insertPaneAfterState,
  moveTab as moveTabState,
  moveTabToNewPane as moveTabToNewPaneState,
  splitPane as splitPaneState,
  updateTab as updateTabState,
  type DockId,
  type DocksState,
  type TabKind,
  type TabStatus,
} from '../../shared/docks/dock-tabs';
import {
  shouldAnnounce,
  signalForTransition,
  type TabSignal,
} from '../../shared/docks/tab-signals';
import { t, tf } from './i18n';
import { playTabSignal } from './sounds';
import { createTerminalInstance, disposeTerminalInstance, serializeTerminal } from './terminals';
import { useDialogs } from './ui-dialogs';
import { useWorkspace } from './workspace';

interface AddTabOptions {
  /** Argumenty komendy startowej (np. ['/login'] dla logowania Claude). */
  args?: string[];
  /** Tytuł zakładki zamiast domyślnego. */
  title?: string;
  /** Panel docelowy (domyślnie ostatni panel doku). */
  paneId?: string;
  /** Podział przestrzeni: nowa sesja ląduje w świeżym panelu tuż za wskazanym. */
  splitAfterPaneId?: string;
  /** Katalog startowy pty — domyślnie korzeń projektu (worktree'y, M72). */
  cwd?: string;
}

interface DocksValue {
  docks: DocksState;
  addTab(dock: DockId, kind: TabKind, options?: AddTabOptions): void;
  activateTab(dock: DockId, paneId: string, id: string): void;
  closeTab(id: string): void;
  moveTab(id: string, targetDock: DockId, targetPaneId?: string): void;
  /** Upuszczenie przy krawędzi panelu: karta jedzie do NOWEGO panelu obok (M77). */
  moveTabToNewPane(
    id: string,
    dock: DockId,
    anchorPaneId: string,
    side: 'before' | 'after',
  ): void;
  /** Wydziela zakładkę do nowego panelu obok (podział ekranu doku). */
  splitTab(id: string): void;
  /** Wyciąga kartę do osobnego okna (proces i scrollback zostają). */
  detachTab(id: string): void;
  /** Wpisuje tekst do pty aktywnej sesji Claude (preferuje aktywne zakładki paneli). */
  insertToActiveClaude(text: string): boolean;
}

const DocksContext = createContext<DocksValue | null>(null);

export function useDocks(): DocksValue {
  const value = useContext(DocksContext);
  if (!value) {
    throw new Error('useDocks wymaga DocksProvider');
  }
  return value;
}

let nextTabNumber = 1;
let nextPaneNumber = 1;

export function DocksProvider({ children }: { children: ReactNode }): ReactElement {
  const { root } = useWorkspace();
  const { confirmDialog, notify } = useDialogs();
  const [docks, setDocksRaw] = useState<DocksState>(emptyDocksState);
  const docksRef = useRef(docks);
  // Karty, których status przejęły hooki (M35) — heurystyka pty ich nie dotyka.
  // Bez tego spóźniony chunk wyjścia nadpisywał status ustawiony hookiem (wyścig).
  const hookDrivenRef = useRef(new Set<string>());
  /** Poprzednie statusy kart — na nich stoją ogłoszenia stanu (M100). */
  const statusesRef = useRef(new Map<string, TabStatus>());
  const lastSignalsRef = useRef(new Map<string, { signal: TabSignal; at: number }>());

  const applyDocks = useCallback((updater: (state: DocksState) => DocksState) => {
    docksRef.current = updater(docksRef.current);
    setDocksRaw(docksRef.current);
  }, []);

  const addTab = useCallback(
    (dock: DockId, kind: TabKind, options?: AddTabOptions) => {
      const cwd = options?.cwd ?? root;
      void window.api.ptyCreate({ kind, cwd, args: options?.args }).then((result) => {
        if (!result.ok) {
          notify(tf('dock.spawnFailed', { error: result.error }), 'error');
          return;
        }
        const id = `tab-${nextTabNumber++}`;
        // Wskaźnik statusu: heurystyka na strumieniu wyjściowym pty,
        // tylko dla zakładek `claude`.
        const statusTracker =
          kind === 'claude'
            ? createClaudeStatusTracker((activity) => {
                applyDocks((state) => {
                  const found = findTab(state, id);
                  if (!found || found.tab.status === 'exited' || hookDrivenRef.current.has(id)) {
                    return state;
                  }
                  return updateTabState(state, id, { status: activity });
                });
              })
            : null;
        const onOutput = statusTracker
          ? (chunk: string): void => statusTracker.push(chunk)
          : undefined;
        createTerminalInstance(id, result.ptyId, { kind, onOutput });
        applyDocks((state) => {
          let next = state;
          let targetPaneId = options?.paneId;
          if (options?.splitAfterPaneId) {
            const newPaneId = `pane-${++nextPaneNumber}`;
            next = insertPaneAfterState(next, dock, options.splitAfterPaneId, newPaneId);
            targetPaneId = newPaneId;
          }
          return addTabState(
            next,
            dock,
            {
              id,
              kind,
              title: options?.title ?? result.title,
              cwd,
              ptyId: result.ptyId,
              status: 'running',
            },
            targetPaneId,
          );
        });
      });
    },
    [applyDocks, notify, root],
  );

  const activateTab = useCallback(
    (dock: DockId, paneId: string, id: string) =>
      applyDocks((state) => activateTabState(state, dock, paneId, id)),
    [applyDocks],
  );

  const closeTab = useCallback(
    (id: string) => {
      const found = findTab(docksRef.current, id);
      if (!found) {
        return;
      }
      const finish = (): void => {
        void window.api.ptyKill(found.tab.ptyId);
        disposeTerminalInstance(id);
        applyDocks((state) => closeTabState(state, id));
      };
      if (found.tab.status === 'exited') {
        finish();
        return;
      }
      // Zamknięcie karty ubija proces — pytamy, dopóki żyje. Ustawienie czytamy
      // przy każdym kliknięciu (M99), bo przełącznik w Ustawieniach ma działać
      // od razu; podręczna kopia w rendererze rozjeżdżałaby się z nim po cichu.
      void window.api.getConfirmCloseTab().then((ask) => {
        if (!ask) {
          finish();
          return;
        }
        void confirmDialog({
          title: t('dock.closeTitle'),
          message: tf('dock.closeMessage', { title: found.tab.title }),
          confirmLabel: t('common.close'),
          danger: true,
          dontAsk: {
            label: t('dock.closeDontAsk'),
            onChoice: () => void window.api.setConfirmCloseTab(false),
          },
        }).then((accepted) => {
          if (accepted) {
            finish();
          }
        });
      });
    },
    [applyDocks, confirmDialog],
  );

  const moveTab = useCallback(
    (id: string, targetDock: DockId, targetPaneId?: string) =>
      applyDocks((state) => moveTabState(state, id, targetDock, targetPaneId)),
    [applyDocks],
  );

  const moveTabToNewPane = useCallback(
    (id: string, dock: DockId, anchorPaneId: string, side: 'before' | 'after') =>
      applyDocks((state) =>
        moveTabToNewPaneState(state, id, dock, anchorPaneId, side, `pane-${++nextPaneNumber}`),
      ),
    [applyDocks],
  );

  const splitTab = useCallback(
    (id: string) => applyDocks((state) => splitPaneState(state, id, `pane-${++nextPaneNumber}`)),
    [applyDocks],
  );

  const detachTab = useCallback(
    (id: string) => {
      const found = findTab(docksRef.current, id);
      if (!found) {
        return;
      }
      const serialized = serializeTerminal(id) ?? '';
      disposeTerminalInstance(id);
      applyDocks((state) => closeTabState(state, id));
      void window.api.openTerminalWindow({
        ptyId: found.tab.ptyId,
        kind: found.tab.kind,
        title: found.tab.title,
        cwd: found.tab.cwd,
        serialized,
      });
    },
    [applyDocks],
  );

  const insertToActiveClaude = useCallback((text: string): boolean => {
    const state = docksRef.current;
    const candidates = [
      ...activeTabs(state).filter((tab) => tab.kind === 'claude' && tab.status !== 'exited'),
      ...allTabs(state).filter((tab) => tab.kind === 'claude' && tab.status !== 'exited'),
    ];
    const target = candidates[0];
    if (!target) {
      return false;
    }
    window.api.ptyWrite(target.ptyId, text);
    return true;
  }, []);

  // Wyjście procesu → status 'exited' na zakładce (proces ubijamy dopiero przy zamknięciu).
  useEffect(() => {
    window.api.onPtyExit(({ ptyId, exitCode }) => {
      const exited = allTabs(docksRef.current).find((tab) => tab.ptyId === ptyId);
      if (exited) {
        hookDrivenRef.current.delete(exited.id);
        applyDocks((state) =>
          updateTabState(state, exited.id, { status: 'exited', failed: exitCode !== 0 }),
        );
      }
    });
  }, [applyDocks]);

  // Deterministyczny status z hooków Notification/Stop (M35). Pierwszy hook
  // przejmuje kartę na wyłączność (hookDrivenRef) — heurystyka strumienia pty
  // zostaje fallbackiem wyłącznie dla sesji bez hooków.
  useEffect(() => {
    window.api.onClaudeHookEvent(({ ptyId, kind }) => {
      const target = allTabs(docksRef.current).find(
        (tab) => tab.ptyId === ptyId && tab.kind === 'claude' && tab.status !== 'exited',
      );
      if (!target) {
        return;
      }
      // Samo polecenie nie mówi nic o statusie karty — status zostaje w spokoju.
      if (kind === 'prompt') {
        return;
      }
      hookDrivenRef.current.add(target.id);
      applyDocks((state) =>
        updateTabState(state, target.id, {
          status: kind === 'stop' ? 'idle' : 'needs-input',
        }),
      );
    });
  }, [applyDocks]);

  /**
   * Ogłoszenia stanu kart Claude (M100): dźwięk i powiadomienie w jednym
   * miejscu, na przejściach statusu. Wcześniej powiadamiały wyłącznie hooki,
   * przez co sesje bez hooków milczały, a zgon procesu nie odzywał się wcale.
   * Ustawienia czytamy przy każdym sygnale — przełącznik ma działać od razu.
   */
  useEffect(() => {
    const previous = statusesRef.current;
    const current = new Map<string, TabStatus>();
    const signals: Array<{ signal: TabSignal; title: string; id: string }> = [];
    for (const tab of allTabs(docks)) {
      current.set(tab.id, tab.status);
      if (tab.kind !== 'claude') {
        continue;
      }
      const signal = signalForTransition(previous.get(tab.id), tab.status, tab.failed === true);
      const last = lastSignalsRef.current.get(tab.id);
      if (signal && shouldAnnounce(last, signal, Date.now())) {
        lastSignalsRef.current.set(tab.id, { signal, at: Date.now() });
        signals.push({ signal, title: tab.title, id: tab.id });
      }
    }
    statusesRef.current = current;
    if (signals.length === 0) {
      return;
    }
    void window.api.getNotifyPrefs().then((prefs) => {
      for (const { signal, title } of signals) {
        if (prefs.sounds) {
          playTabSignal(signal);
        }
        // Powiadomienie systemowe ma sens, gdy okno jest w tle — inaczej
        // dubluje kolor karty, który i tak masz przed oczami.
        if (prefs.system && !document.hasFocus() && typeof Notification !== 'undefined') {
          const notification = new Notification(t(`dock.notif.${signal}`), {
            body: tf('dock.notifBody', { title }),
          });
          notification.onclick = () => window.focus();
        }
      }
    });
  }, [docks]);

  return (
    <DocksContext.Provider
      value={{
        docks,
        addTab,
        activateTab,
        closeTab,
        moveTab,
        moveTabToNewPane,
        splitTab,
        detachTab,
        insertToActiveClaude,
      }}
    >
      {children}
    </DocksContext.Provider>
  );
}
