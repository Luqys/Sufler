import { app, BrowserWindow, ipcMain } from 'electron';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { TabKind } from '../shared/docks/dock-tabs';
import type { LayoutVisibilityKey } from '../shared/docks/layout';
import type { HookEntry } from '../shared/skills/hooks-config';
import type { HookLayer, HunkSelection } from '../shared/ipc';
import { IPC } from '../shared/ipc';
import { applyAppearanceAtBoot, getAppearance, setAppearance } from './window/appearance';
import { listClaudeSessions, readClaudeSessionDetails } from './claude/claude-sessions';
import { saveClipboardImage } from './system/clipboard-image';
import { t, tf } from './system/i18n';
import { listMarkdownFiles } from './knowledge/knowledge';
import { buildKnowledgeGraph } from './knowledge/knowledge-graph';
import { closeKnowledgeWatcher, watchKnowledge } from './knowledge/knowledge-watcher';
import { getUsageLimits } from './claude/usage-limits';
import { closeWatcher, setWatchedFiles } from './project/file-watcher';
import { readDirListing, readFileForEditor, readImageForPreview, writeTextFile } from './project/fs-tree';
import { importDroppedPaths } from './project/import-drop';
import { migrateLegacyConfigDir, readLayout, writeLayout } from './window/layout-store';
import { runGitLog, runGitShowCommit } from './git/git-log';
import { runGitCommit } from './git/git-commit';
import { addHook, listHooks, removeHook } from './claude/hooks-config';
import { readUsageHistory } from './claude/usage-history';
import { isDiagnosticsAuto, runDiagnostics, setDiagnosticsAuto } from './project/diagnostics';
import { addWorktree, listWorktrees, mergeWorktree, removeWorktree } from './git/worktrees';
import { searchTranscripts } from './claude/transcript-search';
import { diffAgainstBase } from './git/branch-diff';
import { commitHunks, readFileHunks } from './git/hunk-commit';
import { runGitShowFile } from './git/git-show';
import { runGitStatus } from './git/git-status';
import { startIdeServer, stopIdeServer, updateIdeWorkspaceFolders } from './claude/ide-server';
import {
  getObsidianConfig,
  resolveNoteLinks,
  sendToDailyNote,
  setObsidianConfig,
} from './knowledge/obsidian';
import type { ObsidianRestConfig } from '../shared/knowledge/obsidian-rest';
import { installAppMenu } from './window/menu';
import { readMcpConfig, runMcpGet, runMcpList } from './mcp/index';
import { closeMcpWatcher, watchMcpConfig } from './mcp/watcher';
import { runListFiles } from './project/quick-open';
import { runProjectSearch } from './project/search';
import { closeTreeWatcher, setWatchedTreeDirs } from './project/tree-watcher';
import { createPty, killAllPtys, killPty, listPtyPids, resizePty, writePty } from './claude/pty-manager';
import { getDetachedInfo, openTerminalWindow } from './window/terminal-windows';
import type { DetachedTerminalInfo } from '../shared/ipc';
import { getWiedzaMcpStatus, startWiedzaMcp, stopWiedzaMcp, wiedzaMcpUrl } from './knowledge/wiedza-mcp';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFileCallback);
import {
  chooseProjectParent,
  chooseProjectRoot,
  chooseVaultPath,
  clearVaultPath,
  getProjectRoot,
  getRecentRoots,
  getVaultPath,
  setProjectRoot,
} from './project/project';
import { adoptProject, createProject, defaultProjectParent } from './project/project-create';
import { readProjectIcon } from './project/project-icon';
import { resolveShellEnv } from './system/shell-env';
import {
  createAgent,
  createRule,
  createSkill,
  readSkillsSnapshot,
  setAgentEnabled,
  setSkillEnabled,
} from './skills/skills';
import type {
  AgentCreateInput,
  McpAddResult,
  ProjectCreateInput,
  RuleCreateInput,
  SkillCreateInput,
} from '../shared/ipc';
import {
  buildMcpAddArgs,
  isAlreadyExistsError,
  type McpAddInput,
} from '../shared/mcp/mcp-add';
import { closeSkillsWatcher, watchSkillsSources } from './skills/skills-watcher';
import { isSessionLogEnabled, setSessionLogEnabled } from './claude/session-log';
import { isGlobalSessionLogEnabled, setGlobalSessionLogEnabled } from './claude/session-log-global';
import { summarizeSessionLog } from './claude/session-summary';
import { listCheckpoints, restoreCheckpoint } from './claude/checkpoints';
import { readWorklog } from './knowledge/worklog';
import { openDetachedWindow } from './window/panel-windows';
import type { DetachedTarget } from '../shared/docks/detached';
import { oknoWebPreferences } from './window/preferences';

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
    webPreferences: oknoWebPreferences({ webview: true }),
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
  ipcMain.handle(IPC.ProjectHomeDir, () => homedir());
  ipcMain.handle(IPC.ProjectIcon, (_event, root: string) => readProjectIcon(root));
  ipcMain.handle(IPC.ProjectSetRoot, (_event, path: string) => {
    const changed = setProjectRoot(path);
    updateIdeWorkspaceFolders();
    return changed;
  });
  ipcMain.handle(IPC.ProjectDefaultParent, () => defaultProjectParent());
  ipcMain.handle(IPC.ProjectChooseParent, async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win ? await chooseProjectParent(win) : null;
  });
  ipcMain.handle(IPC.ProjectCreate, async (_event, input: ProjectCreateInput) => {
    const result = await createProject(input.parent, input.name, input.initGit);
    if (result.ok) {
      adoptProject(result.path);
      updateIdeWorkspaceFolders();
    }
    return result;
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
  ipcMain.handle(IPC.FsImportPaths, (_event, root: string, destDir: string, sources: string[]) =>
    importDroppedPaths(root, destDir, sources),
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
  ipcMain.handle(IPC.SessionLogSummarize, (_event, root: string, path: string) =>
    summarizeSessionLog(root, path),
  );
  ipcMain.handle(IPC.CheckpointsList, (_event, root: string) => listCheckpoints(root));
  ipcMain.handle(IPC.WorklogGet, (_event, root: string) => readWorklog(root));
  ipcMain.handle(IPC.DetachedOpen, (_event, info: DetachedTarget) => openDetachedWindow(info));
  ipcMain.handle(IPC.CheckpointsRestore, (_event, root: string, hash: string) =>
    restoreCheckpoint(root, hash),
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
  ipcMain.handle(
    IPC.McpAdd,
    async (_event, root: string, input: McpAddInput): Promise<McpAddResult> => {
      const env = await resolveShellEnv();
      try {
        await execFileAsync('claude', buildMcpAddArgs(input), {
          cwd: root,
          env,
          timeout: 30_000,
          encoding: 'utf8',
        });
      } catch (error) {
        const message = String((error as Error).message ?? error);
        if (isAlreadyExistsError(message)) {
          return { ok: false, error: 'exists' };
        }
        if (/ENOENT|not found/i.test(message)) {
          return { ok: false, error: 'claude-missing' };
        }
        return { ok: false, error: 'failed', cli: message.slice(0, 400) };
      }
      // Zakres `user` idzie do ~/.claude.json, którego obserwator projektu nie
      // widzi — panel dostaje sygnał wprost, żeby nowy serwer pojawił się od razu.
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) {
          win.webContents.send(IPC.McpChanged);
        }
      }
      return { ok: true };
    },
  );
  ipcMain.handle(IPC.GitStatusGet, (_event, root: string) => runGitStatus(root));
  ipcMain.handle(IPC.GitShowFile, (_event, root: string, rev: string, path: string) =>
    runGitShowFile(root, rev, path),
  );
  ipcMain.handle(IPC.GitCommit, (_event, root: string, paths: string[], message: string) =>
    runGitCommit(root, paths, message),
  );
  ipcMain.handle(IPC.UsageHistoryGet, (_event, root: string) => readUsageHistory(root));
  ipcMain.handle(IPC.DiagnosticsRun, (_event, root: string) => runDiagnostics(root));
  ipcMain.handle(IPC.DiagnosticsAutoGet, () => isDiagnosticsAuto());
  ipcMain.handle(IPC.DiagnosticsAutoSet, (_event, enabled: boolean) => setDiagnosticsAuto(enabled));
  ipcMain.handle(IPC.TranscriptSearch, (_event, root: string, query: string) =>
    searchTranscripts(root, query),
  );
  ipcMain.handle(IPC.GitFileHunks, (_event, root: string, path: string) =>
    readFileHunks(root, path),
  );
  ipcMain.handle(
    IPC.GitCommitHunks,
    (_event, root: string, selections: HunkSelection[], message: string) =>
      commitHunks(root, selections, message),
  );
  ipcMain.handle(IPC.WorktreeList, (_event, root: string) => listWorktrees(root));
  ipcMain.handle(IPC.WorktreeDiff, (_event, root: string, branch: string, base: string) =>
    diffAgainstBase(root, branch, base),
  );
  ipcMain.handle(IPC.WorktreeAdd, (_event, root: string, name: string) => addWorktree(root, name));
  ipcMain.handle(IPC.WorktreeRemove, (_event, root: string, path: string) =>
    removeWorktree(root, path),
  );
  ipcMain.handle(IPC.WorktreeMerge, (_event, root: string, branch: string) =>
    mergeWorktree(root, branch),
  );
  ipcMain.handle(IPC.HooksList, (_event, root: string) => listHooks(root));
  ipcMain.handle(IPC.HooksAdd, (_event, root: string, entry: HookEntry) => addHook(root, entry));
  ipcMain.handle(IPC.HooksRemove, (_event, root: string, layer: HookLayer, entry: HookEntry) =>
    removeHook(root, layer, entry),
  );
  ipcMain.handle(IPC.ClaudeSessionsList, (_event, root: string, limit?: number) =>
    listClaudeSessions(root, limit),
  );
  ipcMain.handle(IPC.ClaudeSessionsDetails, (_event, root: string, id: string) =>
    readClaudeSessionDetails(root, id),
  );
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
