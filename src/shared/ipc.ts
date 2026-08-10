import type { Appearance } from './appearance';
import type { ClaudeHookEvent } from './claude-hooks';
import type { ClaudeSessionEntry } from './claude-sessions';
import type { TabKind } from './dock-tabs';
import type { IdeSelection } from './ide-protocol';
import type { KnowledgeGraph } from './graph';
import type { LayoutState, LayoutVisibilityKey } from './layout';
import type { UsageLimitsResult } from './limits';
import type { McpConfigServer, McpDetail, McpListEntry } from './mcp';
import type { SkillOverrideState } from './skills';

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
  FsReadImage: 'fs:read-image',
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
  SkillsCreate: 'skills:create',
  SkillsToggle: 'skills:toggle',
  AgentsToggle: 'skills:agent-toggle',
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
  KnowledgeWatch: 'knowledge:watch',
  KnowledgeChanged: 'knowledge:changed',
  GitLog: 'git:log',
  GitShowCommit: 'git:show-commit',
  UsageLimitsGet: 'usage:limits',
  KnowledgeGraphGet: 'knowledge:graph',
  TerminalDetachOpen: 'terminal:detach-open',
  TerminalDetachInfo: 'terminal:detach-info',
  WiedzaMcpStatus: 'wiedza-mcp:status',
  WiedzaMcpRegister: 'wiedza-mcp:register',
  ClipboardSaveImage: 'clipboard:save-image',
  IdeBridgeRequest: 'ide:bridge-request',
  IdeBridgeResponse: 'ide:bridge-response',
  IdeSelectionChanged: 'ide:selection-changed',
  IdeStatusGet: 'ide:status',
  GitShowFile: 'git:show-file',
  ClaudeSessionsList: 'claude-sessions:list',
  ClaudeHookEvent: 'claude-hooks:event',
} as const;

/** Żądanie serwera „ide" do renderera (openDiff, openFile, getOpenEditors…). */
export interface IdeBridgeRequestPayload {
  id: number;
  method: string;
  params: Record<string, unknown>;
}

export interface IdeStatus {
  running: boolean;
  port: number | null;
}

export type GitShowFileResult =
  | { ok: true; content: string }
  /** absent — plik nie istnieje w tej rewizji (dodany/usunięty). */
  | { ok: false; error: 'absent' | 'binary' | 'failed' };

/** Obrazek ze schowka zapisany do pliku tymczasowego (wklejanie do terminala). */
export type SaveClipboardImageResult = { ok: true; path: string } | { ok: false };

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

export type ReadImageResult =
  | { ok: true; dataUri: string; size: number }
  | { ok: false; error: 'too-large' | 'not-image' | 'unreadable' };

export type WriteFileResult = { ok: true } | { ok: false; error: string };

export interface WatchEvent {
  path: string;
  kind: 'changed' | 'deleted';
}

export type PtyCreateResult =
  | { ok: true; ptyId: number; pid: number; title: string }
  | { ok: false; error: string };

/** Karta wyciągnięta do osobnego okna: proces + zserializowany scrollback. */
export interface DetachedTerminalInfo {
  ptyId: number;
  kind: TabKind;
  title: string;
  cwd: string;
  serialized: string;
}

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
  /** Efektywny stan skillOverrides (settings.local > projekt > użytkownik). */
  override: SkillOverrideState;
  /** false ⇔ override "off" — Claude w ogóle nie widzi skilla. */
  enabled: boolean;
}

export type SkillScope = 'project' | 'personal';

export interface SkillCreateInput {
  scope: SkillScope;
  name: string;
  description: string;
  /** true → frontmatter `disable-model-invocation`. */
  manual: boolean;
  disallowedTools?: string;
  body: string;
}

export type SkillCreateResult =
  | { ok: true; path: string }
  | { ok: false; error: 'invalid-name' | 'exists' | 'write-failed' };

export type SkillToggleResult =
  | { ok: true; enabled: boolean }
  | { ok: false; error: 'settings-unreadable' | 'write-failed' };

export interface AgentEntry {
  name: string;
  description: string;
  path: string;
  tools?: string;
  model?: string;
  /** false ⇔ reguła `Agent(nazwa)` w permissions.deny któregoś z settings. */
  enabled: boolean;
  /** Deny w settings.json projektu lub użytkownika — lokalny przełącznik go nie cofnie. */
  deniedElsewhere: boolean;
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
  /** Obrazek jako data URI — do podglądu w zakładce edytora. */
  readImage(filePath: string): Promise<ReadImageResult>;
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
  /** Kreator: nowy katalog skilla z plikiem SKILL.md. */
  createSkill(root: string, input: SkillCreateInput): Promise<SkillCreateResult>;
  /** Przełącznik skillOverrides w <root>/.claude/settings.local.json. */
  setSkillEnabled(root: string, name: string, enabled: boolean): Promise<SkillToggleResult>;
  /** Przełącznik subagenta: reguła Agent(nazwa) w permissions.deny settings.local.json. */
  setAgentEnabled(root: string, name: string, enabled: boolean): Promise<SkillToggleResult>;
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
  /** Obserwacja notatek .md: zdarzenia zmian + automatyczny konspekt wiedzy. */
  watchKnowledge(root: string): Promise<void>;
  onKnowledgeChanged(listener: () => void): void;
  gitLog(root: string): Promise<GitLogResult>;
  gitShowCommit(root: string, hash: string): Promise<GitCommitFile[]>;
  getUsageLimits(force?: boolean): Promise<UsageLimitsResult>;
  getKnowledgeGraph(root: string): Promise<KnowledgeGraph>;
  openTerminalWindow(info: DetachedTerminalInfo): Promise<void>;
  getDetachedInfo(ptyId: number): Promise<DetachedTerminalInfo | null>;
  getWiedzaMcpStatus(): Promise<{ running: boolean; url: string; error: string | null }>;
  registerWiedzaMcp(): Promise<{ ok: boolean; message: string }>;
  /** Zapisuje obrazek ze schowka do pliku tymczasowego i zwraca jego ścieżkę. */
  saveClipboardImage(): Promise<SaveClipboardImageResult>;
  /** Ścieżka dyskowa pliku z drag & drop (Electron webUtils). */
  pathForFile(file: File): string;
  /** Subskrypcja na całe życie okna: żądania serwera „ide" (tylko okno główne). */
  onIdeBridgeRequest(listener: (request: IdeBridgeRequestPayload) => void): void;
  ideBridgeRespond(id: number, result: unknown): void;
  /** Zmiana zaznaczenia w edytorze → cache w main + notyfikacja do CLI. */
  ideSelectionChanged(selection: IdeSelection): void;
  getIdeStatus(): Promise<IdeStatus>;
  /** Treść pliku z rewizji gita (`git show rev:ścieżka`) — do zakładek diffów. */
  gitShowFile(root: string, rev: string, path: string): Promise<GitShowFileResult>;
  /** Zapisane sesje Claude projektu — menu „Wznów sesję" (claude --resume). */
  listClaudeSessions(root: string): Promise<ClaudeSessionEntry[]>;
  /** Hooki Notification/Stop sesji Claude → deterministyczny status karty. */
  onClaudeHookEvent(listener: (event: ClaudeHookEvent) => void): void;
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
}

export interface GitCommit {
  hash: string;
  shortHash: string;
  /** Hashe rodziców (%P) — do rysowania torów gałęzi. */
  parents: string[];
  author: string;
  /** ISO 8601 (%aI). */
  date: string;
  subject: string;
  /** Dalsza część opisu commita (%b); pusty string, gdy commit ma tylko temat. */
  body: string;
}

export interface GitCommitFile {
  /** Pierwsza litera statusu: A/M/D/R/C/T. */
  status: string;
  path: string;
}

export type GitLogResult =
  | { ok: true; branch: string; commits: GitCommit[] }
  | { ok: false };
