import { app, BrowserWindow, ipcMain, nativeTheme } from 'electron';
import { join } from 'node:path';
import { IPC } from '../shared/ipc';
import { closeWatcher, setWatchedFiles } from './file-watcher';
import { readDirListing, readFileForEditor, writeTextFile } from './fs-tree';
import { readLayout, writeLayout } from './layout-store';
import { chooseProjectRoot, getProjectRoot } from './project';

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
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1e1f24' : '#f5f5f7',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
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
  ipcMain.handle(IPC.LayoutGet, () => readLayout());
  ipcMain.handle(IPC.LayoutSet, (_event, raw: unknown) => {
    writeLayout(raw);
  });
  ipcMain.handle(IPC.ProjectGetRoot, () => getProjectRoot());
  ipcMain.handle(IPC.ProjectOpenDialog, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win ? chooseProjectRoot(win) : null;
  });
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
});
