import { app, BrowserWindow, ipcMain } from 'electron';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { TabKind } from '../shared/dock-tabs';
import { IPC } from '../shared/ipc';
import { applyAppearanceAtBoot, getAppearance, setAppearance } from './appearance';
import { getClaudeUsage } from './usage';
import { closeWatcher, setWatchedFiles } from './file-watcher';
import { readDirListing, readFileForEditor, writeTextFile } from './fs-tree';
import { readLayout, writeLayout } from './layout-store';
import { runGitStatus } from './git-status';
import { installAppMenu } from './menu';
import { readMcpConfig, runMcpGet, runMcpList } from './mcp/index';
import { closeMcpWatcher, watchMcpConfig } from './mcp/watcher';
import { runProjectSearch } from './search';
import { closeTreeWatcher, setWatchedTreeDirs } from './tree-watcher';
import { createPty, killAllPtys, killPty, listPtyPids, resizePty, writePty } from './pty-manager';
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
import { readSkillsSnapshot } from './skills';
import { closeSkillsWatcher, watchSkillsSources } from './skills-watcher';

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    title: 'VisualN3O',
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
  applyAppearanceAtBoot();

  ipcMain.handle(IPC.LayoutGet, () => readLayout());
  ipcMain.handle(IPC.AppearanceGet, () => getAppearance());
  ipcMain.handle(IPC.AppearanceSet, (_event, raw: unknown) => setAppearance(raw));
  ipcMain.handle(IPC.UsageGet, (_event, force?: boolean) => getClaudeUsage(force));
  ipcMain.handle(IPC.LayoutSet, (_event, raw: unknown) => {
    writeLayout(raw);
  });
  ipcMain.handle(IPC.ProjectGetRoot, () => getProjectRoot());
  ipcMain.handle(IPC.ProjectRecentRoots, () => getRecentRoots());
  ipcMain.handle(IPC.ProjectSetRoot, (_event, path: string) => setProjectRoot(path));
  ipcMain.handle(IPC.ProjectOpenDialog, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win ? chooseProjectRoot(win) : null;
  });
  ipcMain.handle(IPC.PreviewGetPreloadPath, () =>
    pathToFileURL(join(__dirname, '../preload/webview.js')).href,
  );
  ipcMain.handle(IPC.FsReadDir, (_event, dirPath: string) => readDirListing(dirPath));
  ipcMain.handle(IPC.FsReadFile, (_event, filePath: string) => readFileForEditor(filePath));
  ipcMain.handle(IPC.FsWriteFile, (_event, filePath: string, content: string) =>
    writeTextFile(filePath, content),
  );
  ipcMain.handle(IPC.WatchSetFiles, (event, paths: string[]) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      setWatchedFiles(win, paths);
    }
  });
  ipcMain.handle(IPC.PtyCreate, (event, options: { kind: TabKind; cwd: string }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win ? createPty(win, options) : { ok: false as const, error: 'Brak okna' };
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

  installAppMenu(
    () => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send(IPC.OpenSettings);
      }
    },
    (key) => {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send(IPC.TogglePanel, key);
      }
    },
  );

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
  killAllPtys();
});
