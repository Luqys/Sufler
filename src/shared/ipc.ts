import type { Appearance } from './appearance';
import type { TabKind } from './dock-tabs';
import type { KnowledgeGraph } from './graph';
import type { LayoutState, LayoutVisibilityKey } from './layout';
import type { UsageLimitsResult } from './limits';
import type { McpConfigServer, McpDetail, McpListEntry } from './mcp';

export const IPC = {
  LayoutGet: 'layout:get',
  LayoutSet: 'layout:set',
  ProjectGetRoot: 'project:get-root',
  ProjectOpenDialog: 'project:open-dialog',
  ProjectRecentRoots: 'project:recent-roots',
  ProjectSetRoot: 'project:set-root',
  PreviewGetPreloadPath: 'preview:get-preload-path',
  FsReadDir: 'fs:read-dir',
  FsReadFile: 'fs:read-file',
  FsWriteFile: 'fs:write-file',
  WatchSetFiles: 'watch:set-files',
  WatchEvent: 'watch:event',
  PtyCreate: 'pty:create',
  PtyWrite: 'pty:write',
  PtyResize: 'pty:resize',
  PtyKill: 'pty:kill',
  PtyData: 'pty:data',
  PtyExit: 'pty:exit',
  SkillsGet: 'skills:get',
  SkillsWatch: 'skills:watch',
  SkillsChanged: 'skills:changed',
  McpReadConfig: 'mcp:read-config',
  McpListStatus: 'mcp:list-status',
  McpGetDetails: 'mcp:get-details',
  McpWatch: 'mcp:watch',
  McpChanged: 'mcp:changed',
  GitStatusGet: 'git:status',
  TreeWatchDirs: 'tree:watch-dirs',
  TreeChanged: 'tree:changed',
  SearchRun: 'search:run',
  VaultGet: 'vault:get',
  VaultChoose: 'vault:choose-dialog',
  VaultClear: 'vault:clear',
  OpenSettings: 'app:open-settings',
  TogglePanel: 'app:toggle-panel',
  AppearanceGet: 'appearance:get',
  AppearanceSet: 'appearance:set',
  KnowledgeList: 'knowledge:list',
  KnowledgeGenerate: 'knowledge:generate',
  GitLog: 'git:log',
  GitShowCommit: 'git:show-commit',
  UsageLimitsGet: 'usage:limits',
  KnowledgeGraphGet: 'knowledge:graph',
} as const;

export interface DirEntry {
  name: string;
  /** Ścieżka absolutna. */
  path: string;
  kind: 'dir' | 'file';
  /** Czy wpis pasuje do reguł .gitignore (liczone przez `git check-ignore`). */
  ignored: boolean;
}

export type ReadDirResult =
  | { ok: true; entries: DirEntry[] }
  | { ok: false; error: string };

export type ReadFileError = 'too-large' | 'binary' | 'unreadable';

export type ReadFileResult =
  | { ok: true; content: string }
  | { ok: false; error: ReadFileError };

export type WriteFileResult = { ok: true } | { ok: false; error: string };

export interface WatchEvent {
  path: string;
  kind: 'changed' | 'deleted';
}

export type PtyCreateResult =
  | { ok: true; ptyId: number; pid: number; title: string }
  | { ok: false; error: string };

export interface PtyDataEvent {
  ptyId: number;
  data: string;
}

export interface PtyExitEvent {
  ptyId: number;
  exitCode: number;
}

export interface SkillEntry {
  name: string;
  description: string;
  path: string;
  /** disable-model-invocation: true — skill wywoływany tylko ręcznie. */
  manual: boolean;
  disallowedTools?: string;
}

export interface AgentEntry {
  name: string;
  description: string;
  path: string;
  tools?: string;
  model?: string;
}

export interface RuleEntry {
  name: string;
  path: string;
  paths?: string;
}

export interface ClaudeMdEntry {
  label: string;
  path: string;
  lines: number;
}

export interface SkillsSnapshot {
  projectSkills: SkillEntry[];
  personalSkills: SkillEntry[];
  agents: AgentEntry[];
  rules: RuleEntry[];
  claudeMd: ClaudeMdEntry[];
}

/** API udostępniane rendererowi przez contextBridge (window.api). */
export interface WindowApi {
  getLayout(): Promise<LayoutState>;
  setLayout(state: LayoutState): Promise<void>;
  /** null → pokaż ekran startowy z wyborem folderu. */
  getProjectRoot(): Promise<string | null>;
  getRecentRoots(): Promise<string[]>;
  setProjectRoot(path: string): Promise<boolean>;
  openProjectDialog(): Promise<string | null>;
  /** Ścieżka file:// preloadu dla <webview> podglądu przeglądarki. */
  getWebviewPreloadPath(): Promise<string>;
  readDir(dirPath: string): Promise<ReadDirResult>;
  readFile(filePath: string): Promise<ReadFileResult>;
  writeFile(filePath: string, content: string): Promise<WriteFileResult>;
  /** Deklaratywnie ustawia pełną listę obserwowanych plików (otwarte zakładki). */
  watchFiles(paths: string[]): Promise<void>;
  /** Subskrypcja na całe życie okna — bez wypisu (patrz workspace). */
  onWatchEvent(listener: (event: WatchEvent) => void): void;
  ptyCreate(options: { kind: TabKind; cwd: string; args?: string[] }): Promise<PtyCreateResult>;
  ptyWrite(ptyId: number, data: string): void;
  ptyResize(ptyId: number, cols: number, rows: number): void;
  ptyKill(ptyId: number): Promise<void>;
  /** Subskrypcje na całe życie okna. */
  onPtyData(listener: (event: PtyDataEvent) => void): void;
  onPtyExit(listener: (event: PtyExitEvent) => void): void;
  getSkills(root: string): Promise<SkillsSnapshot>;
  watchSkills(root: string): Promise<void>;
  onSkillsChanged(listener: () => void): void;
  readMcpConfig(root: string): Promise<McpConfigServer[]>;
  listMcpStatus(root: string): Promise<McpStatusResult>;
  getMcpDetails(root: string, name: string): Promise<McpDetail[]>;
  watchMcp(root: string): Promise<void>;
  onMcpChanged(listener: () => void): void;
  gitStatus(root: string): Promise<GitStatusFile[]>;
  watchTreeDirs(dirs: string[]): Promise<void>;
  onTreeChanged(listener: (event: TreeChangedEvent) => void): void;
  searchProject(root: string, query: string): Promise<SearchResult>;
  getVaultPath(): Promise<string | null>;
  chooseVault(): Promise<string | null>;
  clearVault(): Promise<void>;
  /** Menu aplikacji → Ustawienia (Cmd+,). */
  onOpenSettings(listener: () => void): void;
  /** Menu Widok → przełączanie paneli. */
  onTogglePanel(listener: (key: LayoutVisibilityKey) => void): void;
  getAppearance(): Promise<Appearance>;
  setAppearance(appearance: Appearance): Promise<Appearance>;
  listKnowledge(root: string): Promise<KnowledgeFile[]>;
  generateKnowledge(root: string, paths: string[]): Promise<KnowledgeGenerateResult>;
  gitLog(root: string): Promise<GitLogResult>;
  gitShowCommit(root: string, hash: string): Promise<GitCommitFile[]>;
  getUsageLimits(force?: boolean): Promise<UsageLimitsResult>;
  getKnowledgeGraph(root: string): Promise<KnowledgeGraph>;
}

export type McpStatusResult =
  | { ok: true; entries: McpListEntry[] }
  | { ok: false; error: string };

export interface GitStatusFile {
  /** Ścieżka względem korzenia projektu. */
  path: string;
  state: 'modified' | 'untracked';
}

export interface TreeChangedEvent {
  /** Ścieżka zmienionego wpisu (dziecko obserwowanego katalogu). */
  path: string;
}

export interface SearchMatch {
  /** Ścieżka względem korzenia projektu. */
  path: string;
  line: number;
  column: number;
  preview: string;
}

export type SearchResult =
  | { ok: true; matches: SearchMatch[]; truncated: boolean }
  | { ok: false; error: string };

export interface KnowledgeFile {
  /** Ścieżka względem korzenia projektu. */
  path: string;
  lines: number;
  /** Długość treści w znakach — do szacowania tokenów kontekstu (~4 znaki/token). */
  chars: number;
}

export type KnowledgeGenerateResult =
  | { ok: true; path: string; files: number; bytes: number }
  | { ok: false; error: string };

export interface GitCommit {
  hash: string;
  shortHash: string;
  author: string;
  /** ISO 8601 (%aI). */
  date: string;
  subject: string;
}

export interface GitCommitFile {
  /** Pierwsza litera statusu: A/M/D/R/C/T. */
  status: string;
  path: string;
}

export type GitLogResult =
  | { ok: true; branch: string; commits: GitCommit[] }
  | { ok: false };
