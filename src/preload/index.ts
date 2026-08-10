import { contextBridge, ipcRenderer } from 'electron';
import type { Appearance } from '../shared/appearance';
import type { TabKind } from '../shared/dock-tabs';
import type { LayoutVisibilityKey } from '../shared/layout';
import {
  IPC,
  type DetachedTerminalInfo,
  type GitCommitFile,
  type GitLogResult,
  type GitStatusFile,
  type KnowledgeFile,
  type KnowledgeGenerateResult,
  type McpStatusResult,
  type PtyCreateResult,
  type PtyDataEvent,
  type PtyExitEvent,
  type ReadDirResult,
  type ReadFileResult,
  type ReadImageResult,
  type SearchResult,
  type SkillsSnapshot,
  type TreeChangedEvent,
  type WatchEvent,
  type WindowApi,
  type WriteFileResult,
} from '../shared/ipc';
import type { KnowledgeGraph } from '../shared/graph';
import type { LayoutState } from '../shared/layout';
import type { UsageLimitsResult } from '../shared/limits';
import type { McpConfigServer, McpDetail } from '../shared/mcp';

const api: WindowApi = {
  getLayout: (): Promise<LayoutState> => ipcRenderer.invoke(IPC.LayoutGet),
  setLayout: (state: LayoutState): Promise<void> => ipcRenderer.invoke(IPC.LayoutSet, state),
  getProjectRoot: (): Promise<string | null> => ipcRenderer.invoke(IPC.ProjectGetRoot),
  getRecentRoots: (): Promise<string[]> => ipcRenderer.invoke(IPC.ProjectRecentRoots),
  setProjectRoot: (path: string): Promise<boolean> => ipcRenderer.invoke(IPC.ProjectSetRoot, path),
  openProjectDialog: (): Promise<string | null> => ipcRenderer.invoke(IPC.ProjectOpenDialog),
  getWebviewPreloadPath: (): Promise<string> => ipcRenderer.invoke(IPC.PreviewGetPreloadPath),
  readDir: (dirPath: string): Promise<ReadDirResult> => ipcRenderer.invoke(IPC.FsReadDir, dirPath),
  readFile: (filePath: string): Promise<ReadFileResult> =>
    ipcRenderer.invoke(IPC.FsReadFile, filePath),
  readImage: (filePath: string): Promise<ReadImageResult> =>
    ipcRenderer.invoke(IPC.FsReadImage, filePath),
  writeFile: (filePath: string, content: string): Promise<WriteFileResult> =>
    ipcRenderer.invoke(IPC.FsWriteFile, filePath, content),
  watchFiles: (paths: string[]): Promise<void> => ipcRenderer.invoke(IPC.WatchSetFiles, paths),
  onWatchEvent: (listener: (event: WatchEvent) => void): void => {
    ipcRenderer.on(IPC.WatchEvent, (_event, payload: WatchEvent) => listener(payload));
  },
  ptyCreate: (options: {
    kind: TabKind;
    cwd: string;
    args?: string[];
  }): Promise<PtyCreateResult> => ipcRenderer.invoke(IPC.PtyCreate, options),
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
  getVaultPath: (): Promise<string | null> => ipcRenderer.invoke(IPC.VaultGet),
  chooseVault: (): Promise<string | null> => ipcRenderer.invoke(IPC.VaultChoose),
  clearVault: (): Promise<void> => ipcRenderer.invoke(IPC.VaultClear),
  onOpenSettings: (listener: () => void): void => {
    ipcRenderer.on(IPC.OpenSettings, () => listener());
  },
  onTogglePanel: (listener: (key: LayoutVisibilityKey) => void): void => {
    ipcRenderer.on(IPC.TogglePanel, (_event, key: LayoutVisibilityKey) => listener(key));
  },
  getAppearance: (): Promise<Appearance> => ipcRenderer.invoke(IPC.AppearanceGet),
  setAppearance: (appearance: Appearance): Promise<Appearance> =>
    ipcRenderer.invoke(IPC.AppearanceSet, appearance),
  listKnowledge: (root: string): Promise<KnowledgeFile[]> =>
    ipcRenderer.invoke(IPC.KnowledgeList, root),
  generateKnowledge: (root: string, paths: string[]): Promise<KnowledgeGenerateResult> =>
    ipcRenderer.invoke(IPC.KnowledgeGenerate, root, paths),
  gitLog: (root: string): Promise<GitLogResult> => ipcRenderer.invoke(IPC.GitLog, root),
  gitShowCommit: (root: string, hash: string): Promise<GitCommitFile[]> =>
    ipcRenderer.invoke(IPC.GitShowCommit, root, hash),
  getUsageLimits: (force?: boolean): Promise<UsageLimitsResult> =>
    ipcRenderer.invoke(IPC.UsageLimitsGet, force),
  getKnowledgeGraph: (root: string): Promise<KnowledgeGraph> =>
    ipcRenderer.invoke(IPC.KnowledgeGraphGet, root),
  openTerminalWindow: (info: DetachedTerminalInfo): Promise<void> =>
    ipcRenderer.invoke(IPC.TerminalDetachOpen, info),
  getDetachedInfo: (ptyId: number): Promise<DetachedTerminalInfo | null> =>
    ipcRenderer.invoke(IPC.TerminalDetachInfo, ptyId),
};

contextBridge.exposeInMainWorld('api', api);
