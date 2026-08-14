import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type ReactElement,
  type WheelEvent,
} from 'react';
import type { ClaudeSessionEntry } from '../../../../shared/claude/claude-sessions';
import { dropZoneFor, type DropZone } from '../../../../shared/docks/dock-drop';
import type { DockId, DockPane, TabKind } from '../../../../shared/docks/dock-tabs';
import {
  NO_OVERFLOW,
  sameOverflow,
  scrollStep,
  tabSignal,
  tabsOverflow,
  type TabSignal,
} from '../../../../shared/docks/tab-scroll';
import { useDocks } from '../../docks';
import { getLocale, useT } from '../../i18n';
import { useWorkspace } from '../../workspace';
import { TerminalView } from './TerminalView';
import { isOutsideWindow } from '../../../../shared/docks/detached';

const DND_MIME = 'application/x-visualn3o-tab';

const ICON_SPLIT = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
    <rect x="1.8" y="2.6" width="12.4" height="10.8" rx="1.6" />
    <path d="M8 2.6v10.8" />
  </svg>
);

const ICON_NEW_CLAUDE = (
  <svg width="15" height="15" viewBox="0 0 16 16">
    <text
      x="8"
      y="12.4"
      textAnchor="middle"
      fontSize="12"
      fontWeight={700}
      fill="#d97757"
      fontFamily="-apple-system, sans-serif"
    >
      ✳
    </text>
  </svg>
);

const ICON_NEW_TERMINAL = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 3.5l4 4-4 4" />
    <path d="M8.5 12h5" />
  </svg>
);

const ICON_TAB_TERMINAL = (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#89e051" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.5 3.5l4 4-4 4" />
    <path d="M8.5 12h5" />
  </svg>
);

const ICON_RESUME = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#d97757" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13.5 8a5.5 5.5 0 1 1-1.7-3.9" />
    <path d="M13.7 1.9v2.7H11" />
    <path d="M8 5.2v3l2 1.2" />
  </svg>
);

const ICON_CHEVRON_LEFT = (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 3.2L5.2 8 10 12.8" />
  </svg>
);

const ICON_CHEVRON_RIGHT = (
  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 3.2L10.8 8 6 12.8" />
  </svg>
);

/** „Favicon" karty doku — szybka orientacja, co siedzi w której karcie. */
function dockTabIcon(kind: TabKind): ReactElement {
  return kind === 'claude' ? ICON_NEW_CLAUDE : ICON_TAB_TERMINAL;
}

/** Menu „Wznów sesję": zapisane sesje projektu → `claude --resume <id>` (M34). */
function ResumeMenu({
  dockId,
  paneId,
  first,
}: {
  dockId: DockId;
  paneId: string;
  first: boolean;
}): ReactElement {
  const { addTab } = useDocks();
  const { root } = useWorkspace();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<ClaudeSessionEntry[] | 'loading'>('loading');
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setSessions('loading');
    void window.api.listClaudeSessions(root).then(setSessions);
    const onPointerDown = (event: PointerEvent): void => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, [open, root]);

  const resume = (session: ClaudeSessionEntry): void => {
    setOpen(false);
    addTab(dockId, 'claude', {
      paneId,
      args: ['--resume', session.id],
      title: t('dock.resumeTabTitle'),
    });
  };

  return (
    <div className="dock-resume-wrap" ref={wrapRef}>
      <button
        type="button"
        className="dock-add"
        data-testid={first ? `${dockId}-resume` : undefined}
        title={t('dock.resume')}
        onClick={() => setOpen((current) => !current)}
      >
        {ICON_RESUME}
      </button>
      {open && (
        <div className="dock-resume-menu" data-testid={first ? `${dockId}-resume-menu` : undefined}>
          {sessions === 'loading' && (
            <div className="dock-resume-note">{t('dock.resumeLoading')}</div>
          )}
          {sessions !== 'loading' && sessions.length === 0 && (
            <div className="dock-resume-note">{t('dock.resumeEmpty')}</div>
          )}
          {sessions !== 'loading' &&
            sessions.map((session) => (
              <button
                key={session.id}
                type="button"
                className="dock-resume-item"
                data-testid="resume-session"
                title={session.title}
                onClick={() => resume(session)}
              >
                <span className="dock-resume-item-title">{session.title}</span>
                <span className="dock-resume-item-when">
                  {new Date(session.mtimeMs).toLocaleString(getLocale(), {
                    dateStyle: 'short',
                    timeStyle: 'short',
                  })}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

interface PaneViewProps {
  dockId: DockId;
  pane: DockPane;
  paneIndex: number;
  title: string;
}

/** Jeden panel doku: własny pasek zakładek, [+], podział i terminal aktywnej karty. */
function PaneView({ dockId, pane, paneIndex, title }: PaneViewProps): ReactElement {
  const {
    addTab,
    activateTab,
    closeTab,
    moveTab,
    moveTabToNewPane,
    splitTab,
    detachTab,
  } = useDocks();
  const t = useT();
  /** null = brak przeciągania nad tym panelem; inaczej strefa upuszczenia. */
  const [dropZone, setDropZone] = useState<DropZone | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  /** Co nie mieści się na pasku zakładek — stąd biorą się strzałki (M107). */
  const [overflow, setOverflow] = useState(NO_OVERFLOW);

  const activeTab = pane.tabs.find((tab) => tab.id === pane.activeId) ?? null;
  const first = paneIndex === 0;

  // Pomiar paska: co wyjechało za krawędź i czy niesie sygnał. Karty podają
  // swój sygnał atrybutem, więc pomiar nie musi znać modelu zakładek.
  const measure = useCallback((): void => {
    const el = tabsRef.current;
    if (!el) {
      return;
    }
    const boxes = Array.from(el.querySelectorAll<HTMLElement>('.dock-tab')).map((node) => ({
      offset: node.offsetLeft,
      width: node.offsetWidth,
      signal: (node.dataset['signal'] ?? 'none') as TabSignal,
    }));
    const next = tabsOverflow(boxes, el.scrollLeft, el.clientWidth);
    setOverflow((prev) => (sameOverflow(prev, next) ? prev : next));
  }, []);

  useEffect(() => {
    const el = tabsRef.current;
    if (!el) {
      return;
    }
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      el.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, [measure]);

  // Nowa karta, zmiana tytułu albo stanu zmienia szerokość zawartości paska.
  useEffect(measure, [measure, pane.tabs]);

  // Aktywna karta zawsze w widoku — świeża sesja ląduje na końcu paska.
  useEffect(() => {
    tabsRef.current
      ?.querySelector('.dock-tab.active')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [pane.activeId]);

  const scrollTabs = (direction: -1 | 1): void => {
    const el = tabsRef.current;
    if (el) {
      el.scrollBy({ left: direction * scrollStep(el.clientWidth), behavior: 'smooth' });
    }
  };

  // Mysz z jednym kółkiem nie przewinie poziomo — zamieniamy oś.
  const onTabsWheel = (event: WheelEvent<HTMLDivElement>): void => {
    const el = tabsRef.current;
    if (el && Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
      el.scrollLeft += event.deltaY;
    }
  };

  /** Strefa upuszczenia z pozycji kursora nad panelem (środek albo krawędź). */
  const zoneFrom = (event: DragEvent<HTMLElement>): DropZone => {
    const rect = event.currentTarget.getBoundingClientRect();
    return dropZoneFor(
      dockId,
      { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
      { x: event.clientX, y: event.clientY },
    );
  };

  const onDragOver = (event: DragEvent<HTMLElement>): void => {
    if (event.dataTransfer.types.includes(DND_MIME)) {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'move';
      setDropZone(zoneFrom(event));
    }
  };

  const onDrop = (event: DragEvent<HTMLElement>): void => {
    const tabId = event.dataTransfer.getData(DND_MIME);
    if (tabId) {
      event.preventDefault();
      event.stopPropagation();
      const zone = zoneFrom(event);
      // Krawędź = nowy panel obok (dwie sesje obok siebie), środek = wejście do panelu.
      if (zone === 'center') {
        moveTab(tabId, dockId, pane.id);
      } else {
        moveTabToNewPane(tabId, dockId, pane.id, zone);
      }
    }
    setDropZone(null);
  };

  return (
    <div
      className={`dock-pane${dropZone !== null ? ' drop-target' : ''}`}
      data-testid={`${dockId}-pane-${paneIndex}`}
      data-drop-zone={dropZone ?? undefined}
      onDragOver={onDragOver}
      onDragLeave={() => setDropZone(null)}
      onDrop={onDrop}
    >
      <header className="dock-header">
        <div className="dock-tabs-wrap">
          <div className="dock-tabs" ref={tabsRef} onWheel={onTabsWheel}>
            {pane.tabs.length === 0 && <span className="dock-title">{title}</span>}
            {pane.tabs.map((tab) => (
              <div
                key={tab.id}
                className={`dock-tab${tab.id === pane.activeId ? ' active' : ''}${
                  tab.status === 'exited' ? ' exited' : ''
                }`}
                draggable
                data-status={tab.status}
                data-kind={tab.kind}
                data-failed={tab.failed === true ? 'true' : undefined}
                data-signal={tabSignal(tab.kind, tab.status, tab.failed === true)}
                title={`${tab.title} — ${tab.cwd}`}
                onClick={() => activateTab(dockId, pane.id, tab.id)}
                onDragStart={(event) => {
                  event.dataTransfer.setData(DND_MIME, tab.id);
                  event.dataTransfer.effectAllowed = 'move';
                }}
                onDragEnd={(event) => {
                  // Upuszczenie poza oknem → sesja wyjeżdża do osobnego okna.
                  if (isOutsideWindow(event, window)) {
                    detachTab(tab.id);
                  }
                }}
              >
                <span className="dock-tab-icon">{dockTabIcon(tab.kind)}</span>
                {tab.kind === 'claude' &&
                  tab.id !== pane.activeId &&
                  (tab.status === 'idle' || tab.status === 'needs-input') && (
                    <span
                      className={`status-dot ${tab.status === 'idle' ? 'done' : 'attention'}`}
                      title={
                        tab.status === 'idle' ? t('dock.statusDone') : t('dock.statusAttention')
                      }
                    />
                  )}
                <span className="dock-tab-title">{tab.title}</span>
                <button
                  type="button"
                  className="tab-close"
                  title={t('common.closeTab')}
                  onClick={(event) => {
                    event.stopPropagation();
                    closeTab(tab.id);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          {/* Ciasny pasek: strzałki na krawędziach dojeżdżają do schowanych kart. */}
          {overflow.left && (
            <button
              type="button"
              className="tabs-scroll left"
              data-testid={first ? `${dockId}-tabs-left` : undefined}
              data-signal={overflow.leftSignal}
              title={t('dock.scrollTabsLeft')}
              onClick={() => scrollTabs(-1)}
            >
              {ICON_CHEVRON_LEFT}
            </button>
          )}
          {overflow.right && (
            <button
              type="button"
              className="tabs-scroll right"
              data-testid={first ? `${dockId}-tabs-right` : undefined}
              data-signal={overflow.rightSignal}
              title={t('dock.scrollTabsRight')}
              onClick={() => scrollTabs(1)}
            >
              {ICON_CHEVRON_RIGHT}
            </button>
          )}
        </div>
        <div className="dock-add-wrap">
          <button
            type="button"
            className="dock-add"
            data-testid={first ? `${dockId}-pane-split` : undefined}
            title={t('dock.split')}
            onClick={() => {
              // ≥2 karty: aktywna wyjeżdża do panelu obok. Inaczej panel obok
              // dostaje świeżą sesję — podział działa więc bez ograniczeń.
              if (activeTab && pane.tabs.length >= 2) {
                splitTab(activeTab.id);
              } else {
                addTab(dockId, activeTab?.kind ?? (dockId === 'right' ? 'claude' : 'terminal'), {
                  splitAfterPaneId: pane.id,
                });
              }
            }}
          >
            {ICON_SPLIT}
          </button>
          <button
            type="button"
            className="dock-add"
            data-testid={first ? `${dockId}-new-claude` : undefined}
            title={t('dock.newClaude')}
            onClick={() => addTab(dockId, 'claude', { paneId: pane.id })}
          >
            {ICON_NEW_CLAUDE}
          </button>
          <ResumeMenu dockId={dockId} paneId={pane.id} first={first} />
          <button
            type="button"
            className="dock-add"
            data-testid={first ? `${dockId}-new-terminal` : undefined}
            title={t('dock.newTerminal')}
            onClick={() => addTab(dockId, 'terminal', { paneId: pane.id })}
          >
            {ICON_NEW_TERMINAL}
          </button>
        </div>
      </header>
      <div className="dock-body">
        {activeTab ? (
          <div className="terminal-stack">
            <TerminalView key={activeTab.id} tabId={activeTab.id} />
          </div>
        ) : (
          <div className="dock-empty">
            <p className="placeholder">{t('dock.empty')}</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface DockProps {
  id: DockId;
  title: string;
}

/**
 * Wspólny komponent obu doków: dolny dzieli się na kolumny,
 * prawy na wiersze. Zakładki `terminal` i `claude` różnią się wyłącznie
 * komendą startową pty.
 */
export function Dock({ id, title }: DockProps): ReactElement {
  const { docks, moveTab } = useDocks();
  const dock = docks[id];

  // Fallback: upuszczenie poza panelami (np. pusty margines) → ostatni panel.
  const onDrop = (event: DragEvent<HTMLElement>): void => {
    const tabId = event.dataTransfer.getData(DND_MIME);
    if (tabId) {
      event.preventDefault();
      moveTab(tabId, id);
    }
  };

  return (
    <section
      className={`dock dock-${id}`}
      data-testid={`${id}-dock`}
      onDragOver={(event) => {
        if (event.dataTransfer.types.includes(DND_MIME)) {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
        }
      }}
      onDrop={onDrop}
    >
      <div className={`dock-panes ${id === 'bottom' ? 'panes-row' : 'panes-column'}`}>
        {dock.panes.map((pane, index) => (
          <PaneView key={pane.id} dockId={id} pane={pane} paneIndex={index} title={title} />
        ))}
      </div>
    </section>
  );
}
