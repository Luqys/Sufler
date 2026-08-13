import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  clampSize,
  type LayoutSizeKey,
  type LayoutState,
  type LayoutVisibilityKey,
} from '../../../../shared/docks/layout';
import type { StringKey } from '../../../../shared/i18n';
import { baseName } from '../../../../shared/editor/paths';
import type { ThemeMode } from '../../../../shared/project/appearance';
import { applyAppearance } from '../../appearance-client';
import { useDocks } from '../../docks';
import { useT } from '../../i18n';
import { selectSidebarView, type SidebarView } from '../../sidebar-view';
import { resetDiagnostics, startDiagnostics, useDiagnostics } from '../../diagnostics-store';
import { autoRunDelay } from '../../../../shared/editor/diagnostics-auto';
import { projectHint, recentProjectsFor } from '../../../../shared/project/recent-projects';
import { useWorkspace } from '../../workspace';
import { CommandPalette, type PaletteAction } from '../dialogs/CommandPalette';
import { Dock } from '../dock/Dock';
import { EditorArea } from '../editor/EditorArea';
import { LayoutToggles } from './LayoutToggles';
import { LoginDialog } from '../dialogs/LoginDialog';
import { QuickOpen } from '../dialogs/QuickOpen';
import { Sidebar } from '../sidebar/Sidebar';
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

/* Kontrolka sprawdzania projektu: „odhaczenie" zamienia się w wirujący łuk. */
const ICON_CHECK = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2.6 8.4l3 3 7.8-7.8" />
  </svg>
);

const ICON_SPIN = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
    <path d="M8 1.8a6.2 6.2 0 1 0 6.2 6.2" />
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
  const {
    root,
    openSettingsTab,
    openHelpTab,
    openKnowledgeGraph,
    openProblemsTab,
    chooseProject,
    switchProject,
    savedTick,
  } = useWorkspace();
  const diagnostyka = useDiagnostics();
  const { addTab } = useDocks();
  const t = useT();
  const [layout, setLayout] = useState(initialLayout);
  const [quickOpenVisible, setQuickOpenVisible] = useState(false);
  const [paletteVisible, setPaletteVisible] = useState(false);
  /** Ostatnie projekty do palety (M87) — czytane raz na otwarcie nakładki. */
  const [recentRoots, setRecentRoots] = useState<string[]>([]);
  const [home, setHome] = useState('');
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

  // Skróty: Cmd+B sidebar, Ctrl+` dolny dok, Cmd+Shift+C prawy dok.
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
      } else if (event.metaKey && !event.shiftKey && !event.ctrlKey && !event.altKey && key === 'k') {
        // Cmd+K — paleta komend (M74).
        event.preventDefault();
        setPaletteVisible((current) => !current);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [toggleVisibility, openSettingsTab]);

  const toggleVisibilityRef = useRef(toggleVisibility);
  toggleVisibilityRef.current = toggleVisibility;

  const openSettingsTabRef = useRef(openSettingsTab);
  openSettingsTabRef.current = openSettingsTab;

  /** Panel palety otwiera się nawet wtedy, gdy sidebar jest schowany. */
  const showPanel = useCallback(
    (view: SidebarView) => {
      selectSidebarView(view);
      if (!layoutRef.current.sidebarVisible) {
        toggleVisibilityRef.current('sidebarVisible');
      }
      if (view === 'knowledge') {
        openKnowledgeGraph();
      }
    },
    [openKnowledgeGraph],
  );

  const setThemeMode = useCallback((mode: ThemeMode) => {
    void window.api.getAppearance().then((appearance) => {
      const next = { ...appearance, mode };
      applyAppearance(next);
      void window.api.setAppearance(next);
    });
  }, []);

  // Lista projektów bywa nieaktualna po przełączeniu — odświeżamy przy otwarciu.
  useEffect(() => {
    if (!paletteVisible) {
      return;
    }
    void window.api.getRecentRoots().then(setRecentRoots);
    void window.api.getHomeDir().then(setHome);
  }, [paletteVisible]);

  // Zmiana projektu unieważnia wynik — pokazywanie cudzych błędów myli (M95).
  useEffect(() => resetDiagnostics(root), [root]);

  /*
   * Diagnostyka po zapisie (M90) mieszka teraz przy przycisku, nie w pasku pod
   * edytorem: stan jest wspólny, więc automat i klik robią dokładnie to samo.
   */
  const [autoDiag, setAutoDiag] = useState(false);
  useEffect(() => {
    void window.api.getDiagnosticsAuto().then(setAutoDiag);
  }, []);
  useEffect(() => {
    if (savedTick === 0) {
      return;
    }
    const zwloka = autoRunDelay(
      { lastFinishedMs: diagnostyka.lastFinishedMs, running: diagnostyka.running },
      autoDiag,
      Date.now(),
    );
    if (zwloka === null) {
      return;
    }
    const timer = window.setTimeout(() => startDiagnostics(root), zwloka);
    return () => window.clearTimeout(timer);
    // Celowo bez `diagnostyka` w zależnościach: każdy zapis planuje jeden przebieg.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDiag, root, savedTick]);

  /** Katalog akcji palety (M74) — panele, doki, widok, motyw, aplikacja. */
  const paletteActions = useMemo((): PaletteAction[] => {
    const panels = t('palette.groupPanels');
    const docksGroup = t('palette.groupDocks');
    const view = t('palette.groupView');
    const theme = t('palette.groupTheme');
    const app = t('palette.groupApp');
    const panelViews: Array<{ id: SidebarView; labelKey: StringKey }> = [
      { id: 'files', labelKey: 'sidebar.rail.files' },
      { id: 'search', labelKey: 'sidebar.rail.search' },
      { id: 'git', labelKey: 'sidebar.rail.git' },
      { id: 'sessions', labelKey: 'sidebar.rail.sessions' },
      { id: 'knowledge', labelKey: 'sidebar.rail.knowledge' },
      { id: 'skills', labelKey: 'sidebar.rail.skills' },
      { id: 'mcp', labelKey: 'sidebar.rail.mcp' },
    ];
    return [
      ...panelViews.map(({ id, labelKey }) => ({
        id: `panel:${id}`,
        label: t(labelKey),
        group: panels,
        run: () => showPanel(id),
      })),
      {
        id: 'dock:claude',
        label: t('palette.newClaude'),
        group: docksGroup,
        run: () => {
          if (!layoutRef.current.rightDockVisible) {
            toggleVisibilityRef.current('rightDockVisible');
          }
          addTab('right', 'claude');
        },
      },
      {
        id: 'dock:terminal',
        label: t('palette.newTerminal'),
        group: docksGroup,
        run: () => {
          if (!layoutRef.current.bottomDockVisible) {
            toggleVisibilityRef.current('bottomDockVisible');
          }
          addTab('bottom', 'terminal');
        },
      },
      {
        id: 'view:sidebar',
        label: t('palette.toggleSidebar'),
        group: view,
        hint: 'Cmd+B',
        run: () => toggleVisibilityRef.current('sidebarVisible'),
      },
      {
        id: 'view:bottom',
        label: t('palette.toggleBottom'),
        group: view,
        hint: 'Ctrl+`',
        run: () => toggleVisibilityRef.current('bottomDockVisible'),
      },
      {
        id: 'view:right',
        label: t('palette.toggleRight'),
        group: view,
        hint: 'Cmd+Shift+C',
        run: () => toggleVisibilityRef.current('rightDockVisible'),
      },
      {
        id: 'theme:light',
        label: t('palette.themeLight'),
        group: theme,
        run: () => setThemeMode('light'),
      },
      {
        id: 'theme:dark',
        label: t('palette.themeDark'),
        group: theme,
        run: () => setThemeMode('dark'),
      },
      {
        id: 'theme:system',
        label: t('palette.themeSystem'),
        group: theme,
        run: () => setThemeMode('system'),
      },
      {
        id: 'app:settings',
        label: t('tabs.settingsTitle'),
        group: app,
        hint: 'Cmd+,',
        run: () => openSettingsTabRef.current(),
      },
      { id: 'app:help', label: t('tabs.helpTitle'), group: app, run: openHelpTab },
      {
        id: 'app:problems',
        label: t('diagnostics.run'),
        group: app,
        run: () => {
          startDiagnostics(root);
          openProblemsTab();
        },
      },
      ...recentProjectsFor(recentRoots, root).map((project) => ({
        id: `project:${project.path}`,
        label: project.name,
        group: t('palette.groupProjects'),
        hint: projectHint(project, home),
        run: () => switchProject(project.path),
      })),
      {
        id: 'project:open',
        label: t('palette.openProject'),
        group: t('palette.groupProjects'),
        run: chooseProject,
      },
      {
        id: 'app:files',
        label: t('palette.quickOpen'),
        group: app,
        hint: 'Cmd+P',
        run: () => setQuickOpenVisible(true),
      },
    ];
  }, [addTab, chooseProject, home, openHelpTab, openProblemsTab, recentRoots, root, setThemeMode, showPanel, switchProject, t]);

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
            className={`titlebar-btn diag-btn${diagnostyka.running ? ' running' : ''}${
              diagnostyka.result && diagnostyka.result.errors > 0 ? ' has-errors' : ''
            }`}
            data-testid="diagnostics-button"
            title={t('diagnostics.checkTitle')}
            onClick={() => {
              startDiagnostics(root);
              openProblemsTab();
            }}
          >
            {diagnostyka.running ? ICON_SPIN : ICON_CHECK}
            {diagnostyka.result !== null && diagnostyka.result.errors > 0 && (
              <span className="diag-count" data-testid="diagnostics-button-count">
                {diagnostyka.result.errors}
              </span>
            )}
          </button>
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
      {paletteVisible && (
        <CommandPalette actions={paletteActions} onClose={() => setPaletteVisible(false)} />
      )}
    </div>
  );
}
