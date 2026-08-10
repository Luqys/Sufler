import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC,
  type ReadDirResult,
  type ReadFileResult,
  type WatchEvent,
  type WindowApi,
  type WriteFileResult,
} from '../shared/ipc';
import type { LayoutState } from '../shared/layout';

const api: WindowApi = {
  getLayout: (): Promise<LayoutState> => ipcRenderer.invoke(IPC.LayoutGet),
  setLayout: (state: LayoutState): Promise<void> => ipcRenderer.invoke(IPC.LayoutSet, state),
  getProjectRoot: (): Promise<string> => ipcRenderer.invoke(IPC.ProjectGetRoot),
  openProjectDialog: (): Promise<string | null> => ipcRenderer.invoke(IPC.ProjectOpenDialog),
  readDir: (dirPath: string): Promise<ReadDirResult> => ipcRenderer.invoke(IPC.FsReadDir, dirPath),
  readFile: (filePath: string): Promise<ReadFileResult> =>
    ipcRenderer.invoke(IPC.FsReadFile, filePath),
  writeFile: (filePath: string, content: string): Promise<WriteFileResult> =>
    ipcRenderer.invoke(IPC.FsWriteFile, filePath, content),
  watchFiles: (paths: string[]): Promise<void> => ipcRenderer.invoke(IPC.WatchSetFiles, paths),
  onWatchEvent: (listener: (event: WatchEvent) => void): void => {
    ipcRenderer.on(IPC.WatchEvent, (_event, payload: WatchEvent) => listener(payload));
  },
};

contextBridge.exposeInMainWorld('api', api);
