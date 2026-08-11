import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { TabKind } from '../shared/dock-tabs';
import type { LayoutVisibilityKey } from '../shared/layout';
import { IPC } from '../shared/ipc';
import { applyAppearanceAtBoot, getAppearance, setAppearance } from './appearance';
import { listClaudeSessions } from './claude-sessions';
import { saveClipboardImage } from './clipboard-image';
import { t, tf } from './i18n';
import { listMarkdownFiles } from './knowledge';
import { buildKnowledgeGraph } from './knowledge-graph';
import { closeKnowledgeWatcher, watchKnowledge } from './knowledge-watcher';
import { getUsageLimits } from './usage-limits';
import { closeWatcher, setWatchedFiles } from './file-watcher';
import { readDirListing, readFileForEditor, readImageForPreview, writeTextFile } from './fs-tree';
import { migrateLegacyConfigDir, readLayout, writeLayout } from './layout-store';
import { runGitLog, runGitShowCommit } from './git-log';
import { runGitShowFile } from './git-show';
import { runGitStatus } from './git-status';
import { startIdeServer, stopIdeServer, updateIdeWorkspaceFolders } from './ide-server';
import {
  getObsidianConfig,
  resolveNoteLinks,
  sendToDailyNote,
  setObsidianConfig,
} from './obsidian';
import type { ObsidianRestConfig } from '../shared/obsidian-rest';
import { installAppMenu } from './menu';
import { readMcpConfig, runMcpGet, runMcpList } from './mcp/index';
import { closeMcpWatcher, watchMcpConfig } from './mcp/watcher';
import { runListFiles } from './quick-open';
import { runProjectSearch } from './search';
import { closeTreeWatcher, setWatchedTreeDirs } from './tree-watcher';
import { createPty, killAllPtys, killPty, listPtyPids, resizePty, writePty } from './pty-manager';
import { getDetachedInfo, openTerminalWindow } from './terminal-windows';
import type { DetachedTerminalInfo } from '../shared/ipc';
import { getWiedzaMcpStatus, startWiedzaMcp, stopWiedzaMcp, wiedzaMcpUrl } from './wiedza-mcp';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFileCallback);
import {
  chooseProjectRoot,
  chooseVaultPath,
  clearVaultPath,
  getProjectRoot,
  getRecentRoots,
  getVaultPath,
  setProjectRoot,
} from './project';
import { resolveShellEnv } from './shell-env';
import {
  createAgent,
  createRule,
  createSkill,
  readSkillsSnapshot,
  setAgentEnabled,
  setSkillEnabled,
} from './skills';
import type { AgentCreateInput, RuleCreateInput, SkillCreateInput } from '../shared/ipc';
import { closeSkillsWatcher, watchSkillsSources } from './skills-watcher';
import { isSessionLogEnabled, setSessionLogEnabled } from './session-log';
import { isGlobalSessionLogEnabled, setGlobalSessionLogEnabled } from './session-log-global';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'Sufler',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 11 },
    // Vibrancy sidebara (SPEC.md, M9) — tło okna musi zostać przezroczyste,
    // półprzezroczyste warstwy maluje CSS.
    vibrancy: 'sidebar',
    visualEffectState: 'followWindow',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      // Podgląd przeglądarki (localhost) w obszarze edytora.
      webviewTag: true,
    },
  });

  win.once('ready-to-show', () => win.show());

  const devServerUrl = process.env['ELECTRON_RENDERER_URL'];
  if (devServerUrl) {
    void win.loadURL(devServerUrl);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

void app.whenReady().then(() => {
  // Przed pierwszym odczytem stanu: przenosiny konfiguracji po zmianie nazwy.
  migrateLegacyConfigDir();
  applyAppearanceAtBoot();

  // W dev ikona docka z build/icon.png (w pakiecie robi to icon.icns).
  if (!app.isPackaged) {
    try {
      app.dock?.setIcon(join(app.getAppPath(), 'build', 'icon.png'));
    } catch {
      // brak pliku — zostaje domyślna ikona Electrona
    }
  }

  const openSettingsInWindows = (): void => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.OpenSettings);
    }
  };
  const togglePanelInWindows = (key: LayoutVisibilityKey): void => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.TogglePanel, key);
    }
  };
  const refreshMenu = (): void =>
    installAppMenu(getAppearance().language, openSettingsInWindows, togglePanelInWindows);

  ipcMain.handle(IPC.LayoutGet, () => readLayout());
  ipcMain.handle(IPC.AppearanceGet, () => getAppearance());
  ipcMain.handle(IPC.AppearanceSet, (_event, raw: unknown) => {
    const before = getAppearance().language;
    const appearance = setAppearance(raw);
    // Natywne menu nie przeładuje się samo — przebudowa przy zmianie języka.
    if (appearance.language !== before) {
      refreshMenu();
    }
    return appearance;
  });
  ipcMain.handle(IPC.UsageLimitsGet, (_event, force?: boolean) => getUsageLimits(force));
  ipcMain.handle(IPC.KnowledgeList, (_event, root: string) => listMarkdownFiles(root));
  ipcMain.handle(IPC.KnowledgeGraphGet, (_event, root: string) => buildKnowledgeGraph(root));
  ipcMain.handle(IPC.KnowledgeWatch, (event, root: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      watchKnowledge(win, root);
    }
  });
  ipcMain.handle(IPC.GitLog, (_event, root: string) => runGitLog(root));
  ipcMain.handle(IPC.GitShowCommit, (_event, root: string, hash: string) =>
    runGitShowCommit(root, hash),
  );
  ipcMain.handle(IPC.LayoutSet, (_event, raw: unknown) => {
    writeLayout(raw);
  });
  ipcMain.handle(IPC.ProjectGetRoot, () => getProjectRoot());
  ipcMain.handle(IPC.ProjectRecentRoots, () => getRecentRoots());
  ipcMain.handle(IPC.ProjectSetRoot, (_event, path: string) => {
    const changed = setProjectRoot(path);
    updateIdeWorkspaceFolders();
    return changed;
  });
  ipcMain.handle(IPC.ProjectOpenDialog, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    const picked = win ? await chooseProjectRoot(win) : null;
    if (picked) {
      updateIdeWorkspaceFolders();
    }
    return picked;
  });
  ipcMain.handle(IPC.PreviewGetPreloadPath, () =>
    pathToFileURL(join(__dirname, '../preload/webview.js')).href,
  );
  ipcMain.handle(IPC.FsReadDir, (_event, dirPath: string) => readDirListing(dirPath));
  ipcMain.handle(IPC.FsReadFile, (_event, filePath: string) => readFileForEditor(filePath));
  ipcMain.handle(IPC.FsReadImage, (_event, filePath: string) => readImageForPreview(filePath));
  ipcMain.handle(IPC.FsWriteFile, (_event, filePath: string, content: string) =>
    writeTextFile(filePath, content),
  );
  ipcMain.handle(IPC.WatchSetFiles, (event, paths: string[]) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      setWatchedFiles(win, paths);
    }
  });
  ipcMain.handle(
    IPC.PtyCreate,
    (_event, options: { kind: TabKind; cwd: string; args?: string[] }) => createPty(options),
  );
  ipcMain.handle(IPC.TerminalDetachOpen, (_event, info: DetachedTerminalInfo) => {
    openTerminalWindow(info);
  });
  ipcMain.handle(IPC.TerminalDetachInfo, (_event, ptyId: number) => getDetachedInfo(ptyId));
  ipcMain.handle(IPC.ClipboardSaveImage, () => saveClipboardImage());
  ipcMain.handle(IPC.WiedzaMcpStatus, () => getWiedzaMcpStatus());
  ipcMain.handle(IPC.WiedzaMcpRegister, async () => {
    try {
      const env = await resolveShellEnv();
      await execFileAsync(
        'claude',
        ['mcp', 'add', '--transport', 'http', 'wiedza-graf', wiedzaMcpUrl(), '-s', 'user'],
        { env, timeout: 20_000, encoding: 'utf8' },
      );
      return {
        ok: true,
        message: t('main.mcpRegistered'),
      };
    } catch (error) {
      const message = String((error as Error).message ?? error);
      return {
        ok: message.includes('already exists'),
        message: message.includes('already exists')
          ? t('main.mcpAlready')
          : tf('main.mcpRegisterFailed', { error: message.slice(0, 200) }),
      };
    }
  });
  ipcMain.on(IPC.PtyWrite, (_event, ptyId: number, data: string) => {
    writePty(ptyId, data);
  });
  ipcMain.on(IPC.PtyResize, (_event, ptyId: number, cols: number, rows: number) => {
    resizePty(ptyId, cols, rows);
  });
  ipcMain.handle(IPC.PtyKill, (_event, ptyId: number) => {
    killPty(ptyId);
  });
  ipcMain.handle(IPC.SkillsGet, (_event, root: string) => readSkillsSnapshot(root));
  ipcMain.handle(IPC.SkillsCreate, (_event, root: string, input: SkillCreateInput) =>
    createSkill(root, input),
  );
  ipcMain.handle(IPC.SkillsToggle, (_event, root: string, name: string, enabled: boolean) =>
    setSkillEnabled(root, name, enabled),
  );
  ipcMain.handle(IPC.AgentsToggle, (_event, root: string, name: string, enabled: boolean) =>
    setAgentEnabled(root, name, enabled),
  );
  ipcMain.handle(IPC.SessionLogGet, () => isSessionLogEnabled());
  ipcMain.handle(IPC.SessionLogSet, (_event, enabled: boolean) => setSessionLogEnabled(enabled));
  ipcMain.handle(IPC.SessionLogGlobalGet, () => isGlobalSessionLogEnabled());
  ipcMain.handle(IPC.SessionLogGlobalSet, (_event, enabled: boolean) =>
    setGlobalSessionLogEnabled(enabled),
  );
  ipcMain.handle(IPC.AgentsCreate, (_event, root: string, input: AgentCreateInput) =>
    createAgent(root, input),
  );
  ipcMain.handle(IPC.RulesCreate, (_event, root: string, input: RuleCreateInput) =>
    createRule(root, input),
  );
  ipcMain.handle(IPC.SkillsWatch, (event, root: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      watchSkillsSources(win, root);
    }
  });
  ipcMain.handle(IPC.McpReadConfig, (_event, root: string) => readMcpConfig(root));
  ipcMain.handle(IPC.McpListStatus, (_event, root: string) => runMcpList(root));
  ipcMain.handle(IPC.McpGetDetails, (_event, root: string, name: string) =>
    runMcpGet(root, name),
  );
  ipcMain.handle(IPC.McpWatch, (event, root: string) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      watchMcpConfig(win, root);
    }
  });
  ipcMain.handle(IPC.GitStatusGet, (_event, root: string) => runGitStatus(root));
  ipcMain.handle(IPC.GitShowFile, (_event, root: string, rev: string, path: string) =>
    runGitShowFile(root, rev, path),
  );
  ipcMain.handle(IPC.ClaudeSessionsList, (_event, root: string) => listClaudeSessions(root));
  ipcMain.handle(IPC.ObsidianResolveLinks, (_event, names: string[]) =>
    resolveNoteLinks(names),
  );
  ipcMain.handle(IPC.ObsidianSendDaily, (_event, content: string) => sendToDailyNote(content));
  ipcMain.handle(IPC.ObsidianConfigGet, () => getObsidianConfig());
  ipcMain.handle(IPC.ObsidianConfigSet, (_event, config: ObsidianRestConfig) =>
    setObsidianConfig(config),
  );
  ipcMain.handle(IPC.ProjectListFiles, (_event, root: string) => runListFiles(root));
  ipcMain.handle(IPC.TreeWatchDirs, (event, dirs: string[]) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      setWatchedTreeDirs(win, dirs);
    }
  });
  ipcMain.handle(IPC.SearchRun, (_event, root: string, query: string) =>
    runProjectSearch(root, query),
  );
  ipcMain.handle(IPC.VaultGet, () => getVaultPath());
  ipcMain.handle(IPC.VaultChoose, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win ? chooseVaultPath(win) : null;
  });
  ipcMain.handle(IPC.VaultClear, () => {
    clearVaultPath();
  });

  // Rozgrzewamy cache środowiska shella, zanim powstanie pierwszy terminal.
  void resolveShellEnv();

  // Serwer MCP grafu wiedzy (loopback) — Claude Code widzi strukturę notatek.
  startWiedzaMcp();

  // Serwer „ide" (loopback) — CLI w naszych zakładkach otwiera diffy w Monaco.
  startIdeServer(() => getProjectRoot());

  refreshMenu();

  // Do testów e2e (Playwright electronApp.evaluate): podgląd żywych pty.
  (globalThis as Record<string, unknown>)['vn3oListPtyPids'] = listPtyPids;

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', () => {
  closeWatcher();
  closeSkillsWatcher();
  closeMcpWatcher();
  closeTreeWatcher();
  closeKnowledgeWatcher();
  stopWiedzaMcp();
  stopIdeServer();
  killAllPtys();
});
