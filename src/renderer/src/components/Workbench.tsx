import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import {
  clampSize,
  type LayoutSizeKey,
  type LayoutState,
  type LayoutVisibilityKey,
} from '../../../shared/layout';
import { baseName } from '../../../shared/paths';
import { useT } from '../i18n';
import { useWorkspace } from '../workspace';
import { Dock } from './Dock';
import { EditorArea } from './EditorArea';
import { LayoutToggles } from './LayoutToggles';
import { LoginDialog } from './LoginDialog';
import { QuickOpen } from './QuickOpen';
import { Sidebar } from './Sidebar';
import { Splitter } from './Splitter';
import { ThemeToggle } from './ThemeToggle';
import { UsageIndicator } from './UsageIndicator';

const ICON_CLAUDE_SPARK = (
  <svg width="15" height="15" viewBox="0 0 16 16">
    <text
      x="8"
      y="12.6"
      textAnchor="middle"
      fontSize="13"
      fontWeight={700}
      fill="#d97757"
      fontFamily="-apple-system, sans-serif"
    >
      ✳
    </text>
  </svg>
);

/* Zębatka i znak zapytania jako SVG w tej samej metryce co reszta paska —
   wcześniej były znakami tekstowymi i odstawały wielkością oraz grubością. */
const ICON_SETTINGS = (
  <svg
    width="15"
    height="15"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="8" cy="8" r="2.1" />
    <path d="M8 1.6v1.6M8 12.8v1.6M14.4 8h-1.6M3.2 8H1.6M12.5 3.5l-1.1 1.1M4.6 11.4l-1.1 1.1M12.5 12.5l-1.1-1.1M4.6 4.6L3.5 3.5" />
  </svg>
);

const ICON_HELP = (
  <svg
    width="15"
    height="15"
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="8" cy="8" r="6.1" />
    <path d="M6.2 6.1a1.85 1.85 0 1 1 2.4 1.85c-.4.15-.6.5-.6.95v.35" />
    <path d="M8 11.6h.01" />
  </svg>
);

const SPLITTER_SIZE = 5;
const MIN_CENTER_WIDTH = 320;
const MIN_EDITOR_HEIGHT = 160;

export function Workbench({ initialLayout }: { initialLayout: LayoutState }): ReactElement {
  const { root, openSettingsTab, openHelpTab } = useWorkspace();
  const t = useT();
  const [layout, setLayout] = useState(initialLayout);
  const [quickOpenVisible, setQuickOpenVisible] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);
  // Lustro stanu aktualizowane synchronicznie — handlery wskaźnika nie mogą
  // czekać na cykl renderowania Reacta.
  const layoutRef = useRef(initialLayout);
  const dragOrigin = useRef<LayoutState | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const apply = useCallback((patch: Partial<LayoutState>) => {
    layoutRef.current = { ...layoutRef.current, ...patch };
    setLayout(layoutRef.current);
  }, []);

  const containerLimit = useCallback((key: LayoutSizeKey): number => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) {
      return Number.POSITIVE_INFINITY;
    }
    const current = layoutRef.current;
    switch (key) {
      case 'sidebarWidth':
        return rect.width - current.rightDockWidth - 2 * SPLITTER_SIZE - MIN_CENTER_WIDTH;
      case 'rightDockWidth':
        return rect.width - current.sidebarWidth - 2 * SPLITTER_SIZE - MIN_CENTER_WIDTH;
      case 'bottomDockHeight':
        return rect.height - SPLITTER_SIZE - MIN_EDITOR_HEIGHT;
    }
  }, []);

  const resize = useCallback(
    (key: LayoutSizeKey, desired: number) => {
      apply({ [key]: clampSize(key, Math.min(desired, containerLimit(key))) });
    },
    [apply, containerLimit],
  );

  const beginDrag = useCallback(() => {
    dragOrigin.current = layoutRef.current;
  }, []);

  const endDrag = useCallback(() => {
    dragOrigin.current = null;
    void window.api.setLayout(layoutRef.current);
  }, []);

  const toggleVisibility = useCallback(
    (key: LayoutVisibilityKey) => {
      apply({ [key]: !layoutRef.current[key] });
      void window.api.setLayout(layoutRef.current);
    },
    [apply],
  );

  // Skróty (SPEC.md): Cmd+B sidebar, Ctrl+` dolny dok, Cmd+Shift+C prawy dok.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      const key = event.key.toLowerCase();
      if (event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey && key === 'b') {
        event.preventDefault();
        toggleVisibility('sidebarVisible');
      } else if (event.ctrlKey && !event.metaKey && !event.altKey && event.key === '`') {
        event.preventDefault();
        toggleVisibility('bottomDockVisible');
      } else if (event.metaKey && event.shiftKey && !event.ctrlKey && !event.altKey && key === 'c') {
        event.preventDefault();
        toggleVisibility('rightDockVisible');
      } else if (event.metaKey && !event.shiftKey && !event.ctrlKey && !event.altKey && key === ',') {
        // Zwykle przechwytuje to accelerator menu; fallback dla zdarzeń
        // syntetycznych (np. testy), które omijają natywne menu.
        event.preventDefault();
        openSettingsTab();
      } else if (event.metaKey && !event.shiftKey && !event.ctrlKey && !event.altKey && key === 'p') {
        // Cmd+P — szybkie otwieranie pliku (M37).
        event.preventDefault();
        setQuickOpenVisible((current) => !current);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [toggleVisibility, openSettingsTab]);

  const toggleVisibilityRef = useRef(toggleVisibility);
  toggleVisibilityRef.current = toggleVisibility;

  const openSettingsTabRef = useRef(openSettingsTab);
  openSettingsTabRef.current = openSettingsTab;

  /** Ikonka Claude na pasku: widżet logowania (modal z `claude /login`). */
  const openClaudeLogin = useCallback(() => {
    setLoginOpen(true);
  }, []);

  // Menu aplikacji → Ustawienia (Cmd+,) i przełączniki paneli z menu Widok.
  useEffect(() => {
    window.api.onOpenSettings(() => openSettingsTabRef.current());
    window.api.onTogglePanel((key) => toggleVisibilityRef.current(key));
  }, []);

  const origin = (): LayoutState => dragOrigin.current ?? layoutRef.current;

  const columns: string[] = [];
  if (layout.sidebarVisible) {
    columns.push(`${layout.sidebarWidth}px`, `${SPLITTER_SIZE}px`);
  }
  columns.push('minmax(0, 1fr)');
  if (layout.rightDockVisible) {
    columns.push(`${SPLITTER_SIZE}px`, `${layout.rightDockWidth}px`);
  }
  const centerRows = layout.bottomDockVisible
    ? `minmax(0, 1fr) ${SPLITTER_SIZE}px ${layout.bottomDockHeight}px`
    : 'minmax(0, 1fr)';

  return (
    <div className="shell">
      <header className="titlebar">
        <span className="titlebar-title">Sufler — {baseName(root)}</span>
        <div className="titlebar-actions">
          <button
            type="button"
            className="titlebar-btn"
            data-testid="settings-button"
            title={t('titlebar.settings')}
            onClick={openSettingsTab}
          >
            {ICON_SETTINGS}
          </button>
          <button
            type="button"
            className="titlebar-btn"
            data-testid="help-button"
            title={t('help.open')}
            onClick={openHelpTab}
          >
            {ICON_HELP}
          </button>
          <button
            type="button"
            className="titlebar-btn"
            data-testid="claude-login-button"
            title={t('titlebar.login')}
            onClick={openClaudeLogin}
          >
            {ICON_CLAUDE_SPARK}
          </button>
          <ThemeToggle />
          <LayoutToggles layout={layout} onToggle={toggleVisibility} />
          <UsageIndicator />
        </div>
      </header>
      <div
        className="workbench"
        data-testid="workbench"
        ref={rootRef}
        style={{ gridTemplateColumns: columns.join(' ') }}
      >
        {layout.sidebarVisible && (
          <>
            <Sidebar />
            <Splitter
              orientation="vertical"
              testId="splitter-sidebar"
              onDragStart={beginDrag}
              onDrag={(dx) => resize('sidebarWidth', origin().sidebarWidth + dx)}
              onDragEnd={endDrag}
            />
          </>
        )}
        <div className="center" style={{ gridTemplateRows: centerRows }}>
          <EditorArea />
          {layout.bottomDockVisible && (
            <>
              <Splitter
                orientation="horizontal"
                testId="splitter-bottom"
                onDragStart={beginDrag}
                onDrag={(_dx, dy) => resize('bottomDockHeight', origin().bottomDockHeight - dy)}
                onDragEnd={endDrag}
              />
              <Dock id="bottom" title={t('dock.bottom')} />
            </>
          )}
        </div>
        {layout.rightDockVisible && (
          <>
            <Splitter
              orientation="vertical"
              testId="splitter-right"
              onDragStart={beginDrag}
              onDrag={(dx) => resize('rightDockWidth', origin().rightDockWidth - dx)}
              onDragEnd={endDrag}
            />
            <Dock id="right" title={t('dock.right')} />
          </>
        )}
      </div>
      {loginOpen && <LoginDialog onClose={() => setLoginOpen(false)} />}
      {quickOpenVisible && <QuickOpen onClose={() => setQuickOpenVisible(false)} />}
    </div>
  );
}
