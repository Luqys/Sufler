import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { Appearance } from '../shared/project/appearance';
import type { HookEntry } from '../shared/skills/hooks-config';
import type { UsageScan } from '../shared/claude/usage-history';
import type { Checkpoint } from '../shared/git/checkpoints';
import type { DetachedTarget } from '../shared/docks/detached';
import type { WorklogEntry } from '../shared/knowledge/worklog';
import type { TabKind } from '../shared/docks/dock-tabs';
import type { LayoutVisibilityKey } from '../shared/docks/layout';
import {
  IPC,
  type AgentCreateInput,
  type DetachedTerminalInfo,
  type GitCommitFile,
  type GitCommitResult,
  type HookLayer,
  type HookListEntry,
  type HookWriteResult,
  type GitLogResult,
  type GitShowFileResult,
  type GitStatusFile,
  type IdeBridgeRequestPayload,
  type IdeStatus,
  type KnowledgeFile,
  type ListFilesResult,
  type McpAddResult,
  type McpStatusResult,
  type ProjectCreateInput,
  type ProjectCreateResult,
  type PtyCreateResult,
  type PtyDataEvent,
  type PtyExitEvent,
  type ReadDirResult,
  type ReadFileResult,
  type ReadImageResult,
  type RuleCreateInput,
  type SaveClipboardImageResult,
  type SearchResult,
  type SkillCreateInput,
  type SkillCreateResult,
  type GlobalSessionLogResult,
  type ImportPathsResult,
  type RestoreResult,
  type SummaryResult,
  type SkillToggleResult,
  type SkillsSnapshot,
  type TreeChangedEvent,
  type WatchEvent,
  type WindowApi,
  type WriteFileResult,
} from '../shared/ipc';
import type { ClaudeHookEvent } from '../shared/claude/claude-hooks';
import type { ClaudeSessionDetails, ClaudeSessionSummary } from '../shared/claude/claude-sessions';
import type { KnowledgeGraph } from '../shared/knowledge/graph';
import type { IdeSelection } from '../shared/system/ide-protocol';
import type { LayoutState } from '../shared/docks/layout';
import type { UsageLimitsResult } from '../shared/claude/limits';
import type { McpConfigServer, McpDetail } from '../shared/mcp/mcp';
import type { McpAddInput } from '../shared/mcp/mcp-add';
import type { ObsidianRestConfig } from '../shared/knowledge/obsidian-rest';
import type { SendToNoteResult } from '../shared/ipc';

const api: WindowApi = {
  getLayout: (): Promise<LayoutState> => ipcRenderer.invoke(IPC.LayoutGet),
  setLayout: (state: LayoutState): Promise<void> => ipcRenderer.invoke(IPC.LayoutSet, state),
  getProjectRoot: (): Promise<string | null> => ipcRenderer.invoke(IPC.ProjectGetRoot),
  getRecentRoots: (): Promise<string[]> => ipcRenderer.invoke(IPC.ProjectRecentRoots),
  getProjectIcon: (root: string): Promise<string | null> =>
    ipcRenderer.invoke(IPC.ProjectIcon, root),
  setProjectRoot: (path: string): Promise<boolean> => ipcRenderer.invoke(IPC.ProjectSetRoot, path),
  openProjectDialog: (): Promise<string | null> => ipcRenderer.invoke(IPC.ProjectOpenDialog),
  createProject: (input: ProjectCreateInput): Promise<ProjectCreateResult> =>
    ipcRenderer.invoke(IPC.ProjectCreate, input),
  getDefaultProjectParent: (): Promise<string> => ipcRenderer.invoke(IPC.ProjectDefaultParent),
  chooseProjectParent: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC.ProjectChooseParent),
  getWebviewPreloadPath: (): Promise<string> => ipcRenderer.invoke(IPC.PreviewGetPreloadPath),
  readDir: (dirPath: string): Promise<ReadDirResult> => ipcRenderer.invoke(IPC.FsReadDir, dirPath),
  readFile: (filePath: string): Promise<ReadFileResult> =>
    ipcRenderer.invoke(IPC.FsReadFile, filePath),
  readImage: (filePath: string): Promise<ReadImageResult> =>
    ipcRenderer.invoke(IPC.FsReadImage, filePath),
  writeFile: (filePath: string, content: string): Promise<WriteFileResult> =>
    ipcRenderer.invoke(IPC.FsWriteFile, filePath, content),
  importPaths: (root: string, destDir: string, sources: string[]): Promise<ImportPathsResult> =>
    ipcRenderer.invoke(IPC.FsImportPaths, root, destDir, sources),
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
  createSkill: (root: string, input: SkillCreateInput): Promise<SkillCreateResult> =>
    ipcRenderer.invoke(IPC.SkillsCreate, root, input),
  setSkillEnabled: (root: string, name: string, enabled: boolean): Promise<SkillToggleResult> =>
    ipcRenderer.invoke(IPC.SkillsToggle, root, name, enabled),
  setAgentEnabled: (root: string, name: string, enabled: boolean): Promise<SkillToggleResult> =>
    ipcRenderer.invoke(IPC.AgentsToggle, root, name, enabled),
  getSessionLogEnabled: (): Promise<boolean> => ipcRenderer.invoke(IPC.SessionLogGet),
  setSessionLogEnabled: (enabled: boolean): Promise<boolean> =>
    ipcRenderer.invoke(IPC.SessionLogSet, enabled),
  getGlobalSessionLog: (): Promise<boolean> => ipcRenderer.invoke(IPC.SessionLogGlobalGet),
  setGlobalSessionLog: (enabled: boolean): Promise<GlobalSessionLogResult> =>
    ipcRenderer.invoke(IPC.SessionLogGlobalSet, enabled),
  summarizeSessionLog: (root: string, path: string): Promise<SummaryResult> =>
    ipcRenderer.invoke(IPC.SessionLogSummarize, root, path),
  listCheckpoints: (root: string): Promise<Checkpoint[]> =>
    ipcRenderer.invoke(IPC.CheckpointsList, root),
  restoreCheckpoint: (root: string, hash: string): Promise<RestoreResult> =>
    ipcRenderer.invoke(IPC.CheckpointsRestore, root, hash),
  onCheckpointsChanged: (listener: () => void): void => {
    ipcRenderer.on(IPC.CheckpointsChanged, () => listener());
  },
  getWorklog: (root: string): Promise<WorklogEntry[]> => ipcRenderer.invoke(IPC.WorklogGet, root),
  openDetachedWindow: (info: DetachedTarget): Promise<void> =>
    ipcRenderer.invoke(IPC.DetachedOpen, info),
  createAgent: (root: string, input: AgentCreateInput): Promise<SkillCreateResult> =>
    ipcRenderer.invoke(IPC.AgentsCreate, root, input),
  createRule: (root: string, input: RuleCreateInput): Promise<SkillCreateResult> =>
    ipcRenderer.invoke(IPC.RulesCreate, root, input),
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
  addMcpServer: (root: string, input: McpAddInput): Promise<McpAddResult> =>
    ipcRenderer.invoke(IPC.McpAdd, root, input),
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
  watchKnowledge: (root: string): Promise<void> => ipcRenderer.invoke(IPC.KnowledgeWatch, root),
  onKnowledgeChanged: (listener: () => void): void => {
    ipcRenderer.on(IPC.KnowledgeChanged, () => listener());
  },
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
  getWiedzaMcpStatus: (): Promise<{ running: boolean; url: string; error: string | null }> =>
    ipcRenderer.invoke(IPC.WiedzaMcpStatus),
  registerWiedzaMcp: (): Promise<{ ok: boolean; message: string }> =>
    ipcRenderer.invoke(IPC.WiedzaMcpRegister),
  onWiedzaMcpChanged: (listener: () => void): void => {
    ipcRenderer.on(IPC.WiedzaMcpChanged, () => listener());
  },
  saveClipboardImage: (): Promise<SaveClipboardImageResult> =>
    ipcRenderer.invoke(IPC.ClipboardSaveImage),
  pathForFile: (file: File): string => webUtils.getPathForFile(file),
  onIdeBridgeRequest: (listener: (request: IdeBridgeRequestPayload) => void): void => {
    ipcRenderer.on(IPC.IdeBridgeRequest, (_event, payload: IdeBridgeRequestPayload) =>
      listener(payload),
    );
  },
  ideBridgeRespond: (id: number, result: unknown): void => {
    ipcRenderer.send(IPC.IdeBridgeResponse, { id, result });
  },
  ideSelectionChanged: (selection: IdeSelection): void => {
    ipcRenderer.send(IPC.IdeSelectionChanged, selection);
  },
  getIdeStatus: (): Promise<IdeStatus> => ipcRenderer.invoke(IPC.IdeStatusGet),
  gitShowFile: (root: string, rev: string, path: string): Promise<GitShowFileResult> =>
    ipcRenderer.invoke(IPC.GitShowFile, root, rev, path),
  gitCommit: (root: string, paths: string[], message: string): Promise<GitCommitResult> =>
    ipcRenderer.invoke(IPC.GitCommit, root, paths, message),
  getUsageHistory: (root: string): Promise<UsageScan> =>
    ipcRenderer.invoke(IPC.UsageHistoryGet, root),
  listHooks: (root: string): Promise<HookListEntry[]> => ipcRenderer.invoke(IPC.HooksList, root),
  addHook: (root: string, entry: HookEntry): Promise<HookWriteResult> =>
    ipcRenderer.invoke(IPC.HooksAdd, root, entry),
  removeHook: (root: string, layer: HookLayer, entry: HookEntry): Promise<HookWriteResult> =>
    ipcRenderer.invoke(IPC.HooksRemove, root, layer, entry),
  listClaudeSessions: (root: string, limit?: number): Promise<ClaudeSessionSummary[]> =>
    ipcRenderer.invoke(IPC.ClaudeSessionsList, root, limit),
  getClaudeSessionDetails: (root: string, id: string): Promise<ClaudeSessionDetails | null> =>
    ipcRenderer.invoke(IPC.ClaudeSessionsDetails, root, id),
  onClaudeHookEvent: (listener: (event: ClaudeHookEvent) => void): void => {
    ipcRenderer.on(IPC.ClaudeHookEvent, (_event, payload: ClaudeHookEvent) =>
      listener(payload),
    );
  },
  resolveNoteLinks: (names: string[]): Promise<Record<string, string | null>> =>
    ipcRenderer.invoke(IPC.ObsidianResolveLinks, names),
  sendToDailyNote: (content: string): Promise<SendToNoteResult> =>
    ipcRenderer.invoke(IPC.ObsidianSendDaily, content),
  getObsidianConfig: (): Promise<ObsidianRestConfig> =>
    ipcRenderer.invoke(IPC.ObsidianConfigGet),
  setObsidianConfig: (config: ObsidianRestConfig): Promise<ObsidianRestConfig> =>
    ipcRenderer.invoke(IPC.ObsidianConfigSet, config),
  listProjectFiles: (root: string): Promise<ListFilesResult> =>
    ipcRenderer.invoke(IPC.ProjectListFiles, root),
};

contextBridge.exposeInMainWorld('api', api);
