import { contextBridge, ipcRenderer } from 'electron';
import { IPC, type WindowApi } from '../shared/ipc';
import type { LayoutState } from '../shared/layout';

const api: WindowApi = {
  getLayout: (): Promise<LayoutState> => ipcRenderer.invoke(IPC.LayoutGet),
  setLayout: (state: LayoutState): Promise<void> => ipcRenderer.invoke(IPC.LayoutSet, state),
};

contextBridge.exposeInMainWorld('api', api);
