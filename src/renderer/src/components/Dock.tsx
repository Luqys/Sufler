import { useEffect, useRef, useState, type DragEvent, type ReactElement } from 'react';
import type { ClaudeSessionEntry } from '../../../shared/claude-sessions';
import type { DockId, DockPane, TabKind } from '../../../shared/dock-tabs';
import { useDocks } from '../docks';
import { getLocale, useT } from '../i18n';
import { getTerminalInstance } from '../terminals';
import { useDialogs } from '../ui-dialogs';
import { useWorkspace } from '../workspace';
import { TerminalView } from './TerminalView';
import { isOutsideWindow } from '../../../shared/detached';

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

const ICON_COPY_PROMPT = (
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round">
    <rect x="5.4" y="1.9" width="8.2" height="10.2" rx="1.5" />
    <path d="M10.6 14.1H3.9a1.5 1.5 0 0 1-1.5-1.5V4.4" />
  </svg>
);

const ICON_RESUME = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="#d97757" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M13.5 8a5.5 5.5 0 1 1-1.7-3.9" />
    <path d="M13.7 1.9v2.7H11" />
    <path d="M8 5.2v3l2 1.2" />
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
  const { addTab, activateTab, closeTab, moveTab, splitTab, detachTab, lastPrompts } = useDocks();
  const { notify } = useDialogs();
  const t = useT();
  const [dropHover, setDropHover] = useState(false);

  const activeTab = pane.tabs.find((tab) => tab.id === pane.activeId) ?? null;
  const first = paneIndex === 0;

  /**
   * Kopiowanie polecenia (zgłoszenie użytkowników): zaznaczenie w terminalu,
   * a gdy go nie ma — ostatnie polecenie wysłane w tej sesji (hook
   * UserPromptSubmit). Przydaje się do przepisania promptu po `/clear`
   * albo do drugiej sesji.
   */
  const copyPrompt = (): void => {
    if (!activeTab) {
      return;
    }
    const selection = getTerminalInstance(activeTab.id)?.term.getSelection().trim() ?? '';
    const text = selection !== '' ? selection : (lastPrompts[activeTab.id] ?? '');
    if (text === '') {
      notify(t('dock.copyPromptEmpty'), 'info');
      return;
    }
    void navigator.clipboard.writeText(text).then(
      () => notify(t('dock.copyPromptOk'), 'success'),
      () => notify(t('dock.copyPromptFailed'), 'error'),
    );
  };

  const onDragOver = (event: DragEvent<HTMLElement>): void => {
    if (event.dataTransfer.types.includes(DND_MIME)) {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = 'move';
      setDropHover(true);
    }
  };

  const onDrop = (event: DragEvent<HTMLElement>): void => {
    const tabId = event.dataTransfer.getData(DND_MIME);
    if (tabId) {
      event.preventDefault();
      event.stopPropagation();
      moveTab(tabId, dockId, pane.id);
    }
    setDropHover(false);
  };

  return (
    <div
      className={`dock-pane${dropHover ? ' drop-target' : ''}`}
      data-testid={`${dockId}-pane-${paneIndex}`}
      onDragOver={onDragOver}
      onDragLeave={() => setDropHover(false)}
      onDrop={onDrop}
    >
      <header className="dock-header">
        <div className="dock-tabs">
          {pane.tabs.length === 0 && <span className="dock-title">{title}</span>}
          {pane.tabs.map((tab) => (
            <div
              key={tab.id}
              className={`dock-tab${tab.id === pane.activeId ? ' active' : ''}${
                tab.status === 'exited' ? ' exited' : ''
              }`}
              draggable
              data-status={tab.status}
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
                    title={tab.status === 'idle' ? t('dock.statusDone') : t('dock.statusAttention')}
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
        <div className="dock-add-wrap">
          {activeTab?.kind === 'claude' && (
            <button
              type="button"
              className="dock-add"
              data-testid={first ? `${dockId}-copy-prompt` : undefined}
              title={t('dock.copyPrompt')}
              onClick={copyPrompt}
            >
              {ICON_COPY_PROMPT}
            </button>
          )}
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
          <TerminalView key={activeTab.id} tabId={activeTab.id} />
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
 * Wspólny komponent obu doków (SPEC.md): dolny dzieli się na kolumny,
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
