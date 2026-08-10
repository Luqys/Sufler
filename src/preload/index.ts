import { contextBridge, ipcRenderer } from 'electron';
import type { TabKind } from '../shared/dock-tabs';
import {
  IPC,
  type GitStatusFile,
  type McpStatusResult,
  type PtyCreateResult,
  type PtyDataEvent,
  type PtyExitEvent,
  type ReadDirResult,
  type ReadFileResult,
  type SearchResult,
  type SkillsSnapshot,
  type TreeChangedEvent,
  type WatchEvent,
  type WindowApi,
  type WriteFileResult,
} from '../shared/ipc';
import type { LayoutState } from '../shared/layout';
import type { McpConfigServer, McpDetail } from '../shared/mcp';

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
  ptyCreate: (options: { kind: TabKind; cwd: string }): Promise<PtyCreateResult> =>
    ipcRenderer.invoke(IPC.PtyCreate, options),
  ptyWrite: (ptyId: number, data: string): void => {
    ipcRenderer.send(IPC.PtyWrite, ptyId, data);
  },
  ptyResize: (ptyId: number, cols: number, rows: number): void => {
    ipcRenderer.send(IPC.PtyResize, ptyId, cols, rows);
  },
  ptyKill: (ptyId: number): Promise<void> => ipcRenderer.invoke(IPC.PtyKill, ptyId),
  onPtyData: (listener: (event: PtyDataEvent) => void): void => {
    ipcRenderer.on(IPC.PtyData, (_event, payload: PtyDataEvent) => listener(payload));
  },
  onPtyExit: (listener: (event: PtyExitEvent) => void): void => {
    ipcRenderer.on(IPC.PtyExit, (_event, payload: PtyExitEvent) => listener(payload));
  },
  getSkills: (root: string): Promise<SkillsSnapshot> => ipcRenderer.invoke(IPC.SkillsGet, root),
  watchSkills: (root: string): Promise<void> => ipcRenderer.invoke(IPC.SkillsWatch, root),
  onSkillsChanged: (listener: () => void): void => {
    ipcRenderer.on(IPC.SkillsChanged, () => listener());
  },
  readMcpConfig: (root: string): Promise<McpConfigServer[]> =>
    ipcRenderer.invoke(IPC.McpReadConfig, root),
  listMcpStatus: (root: string): Promise<McpStatusResult> =>
    ipcRenderer.invoke(IPC.McpListStatus, root),
  getMcpDetails: (root: string, name: string): Promise<McpDetail[]> =>
    ipcRenderer.invoke(IPC.McpGetDetails, root, name),
  watchMcp: (root: string): Promise<void> => ipcRenderer.invoke(IPC.McpWatch, root),
  onMcpChanged: (listener: () => void): void => {
    ipcRenderer.on(IPC.McpChanged, () => listener());
  },
  gitStatus: (root: string): Promise<GitStatusFile[]> =>
    ipcRenderer.invoke(IPC.GitStatusGet, root),
  watchTreeDirs: (dirs: string[]): Promise<void> => ipcRenderer.invoke(IPC.TreeWatchDirs, dirs),
  onTreeChanged: (listener: (event: TreeChangedEvent) => void): void => {
    ipcRenderer.on(IPC.TreeChanged, (_event, payload: TreeChangedEvent) => listener(payload));
  },
  searchProject: (root: string, query: string): Promise<SearchResult> =>
    ipcRenderer.invoke(IPC.SearchRun, root, query),
};

contextBridge.exposeInMainWorld('api', api);
