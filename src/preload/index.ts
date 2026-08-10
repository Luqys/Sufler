import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type ReadDirResult, type ReadFileResult, type WindowApi } from '../shared/ipc';
import type { LayoutState } from '../shared/layout';

const api: WindowApi = {
  getLayout: (): Promise<LayoutState> => ipcRenderer.invoke(IPC.LayoutGet),
  setLayout: (state: LayoutState): Promise<void> => ipcRenderer.invoke(IPC.LayoutSet, state),
  getProjectRoot: (): Promise<string> => ipcRenderer.invoke(IPC.ProjectGetRoot),
  openProjectDialog: (): Promise<string | null> => ipcRenderer.invoke(IPC.ProjectOpenDialog),
  readDir: (dirPath: string): Promise<ReadDirResult> => ipcRenderer.invoke(IPC.FsReadDir, dirPath),
  readFile: (filePath: string): Promise<ReadFileResult> =>
    ipcRenderer.invoke(IPC.FsReadFile, filePath),
};

contextBridge.exposeInMainWorld('api', api);
