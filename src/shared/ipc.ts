import type { Appearance } from './project/appearance';
import type { ClaudeHookEvent } from './claude/claude-hooks';
import type { ClaudeSessionDetails, ClaudeSessionSummary } from './claude/claude-sessions';
import type { TabKind } from './docks/dock-tabs';
import type { IdeSelection } from './system/ide-protocol';
import type { KnowledgeGraph } from './knowledge/graph';
import type { LayoutState, LayoutVisibilityKey } from './docks/layout';
import type { UsageLimitsResult } from './claude/limits';
import type { McpConfigServer, McpDetail, McpListEntry } from './mcp/mcp';
import type { McpAddInput } from './mcp/mcp-add';
import type { ObsidianRestConfig } from './knowledge/obsidian-rest';
import type { Checkpoint } from './git/checkpoints';
import type { DetachedTarget } from './docks/detached';
import type { ImportSkip } from './project/import-drop';
import type { WorklogEntry } from './knowledge/worklog';
import type { HookEntry, HookEvent } from './skills/hooks-config';
import type { UsageScan } from './claude/usage-history';
import type { DiagnosticsResult } from './editor/diagnostics';
import type { Worktree } from './git/worktrees';
import type { BranchDiff } from './git/branch-diff';
import type { SessionHits } from './claude/transcript-search';
import type { SkillOverrideState } from './skills/skills';

export const IPC = {
  LayoutGet: 'layout:get',
  LayoutSet: 'layout:set',
  ProjectGetRoot: 'project:get-root',
  ProjectOpenDialog: 'project:open-dialog',
  ProjectRecentRoots: 'project:recent-roots',
  ProjectIcon: 'project:icon',
  ProjectSetRoot: 'project:set-root',
  /** Nowy folder roboczy z ekranu startowego (M76). */
  ProjectCreate: 'project:create',
  ProjectDefaultParent: 'project:default-parent',
  ProjectChooseParent: 'project:choose-parent',
  PreviewGetPreloadPath: 'preview:get-preload-path',
  FsReadDir: 'fs:read-dir',
  FsReadFile: 'fs:read-file',
  FsReadImage: 'fs:read-image',
  FsWriteFile: 'fs:write-file',
  FsImportPaths: 'fs:import-paths',
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
  SessionLogGet: 'session-log:get',
  SessionLogSet: 'session-log:set',
  SessionLogGlobalGet: 'session-log:global-get',
  SessionLogGlobalSet: 'session-log:global-set',
  SessionLogSummarize: 'session-log:summarize',
  CheckpointsList: 'checkpoints:list',
  CheckpointsRestore: 'checkpoints:restore',
  CheckpointsChanged: 'checkpoints:changed',
  WorklogGet: 'worklog:get',
  DetachedOpen: 'detached:open',
  AgentsCreate: 'skills:agent-create',
  RulesCreate: 'skills:rule-create',
  McpReadConfig: 'mcp:read-config',
  McpListStatus: 'mcp:list-status',
  McpGetDetails: 'mcp:get-details',
  McpWatch: 'mcp:watch',
  McpChanged: 'mcp:changed',
  /** Dodanie serwera MCP z aplikacji (M79) — przez `claude mcp add`. */
  McpAdd: 'mcp:add',
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
  /** Serwer MCP wstał albo padł — panel Wiedza odświeża kropkę statusu. */
  WiedzaMcpChanged: 'wiedza-mcp:changed',
  ClipboardSaveImage: 'clipboard:save-image',
  IdeBridgeRequest: 'ide:bridge-request',
  IdeBridgeResponse: 'ide:bridge-response',
  IdeSelectionChanged: 'ide:selection-changed',
  IdeStatusGet: 'ide:status',
  GitShowFile: 'git:show-file',
  GitCommit: 'git:commit',
  UsageHistoryGet: 'usage:history',
  DiagnosticsRun: 'diagnostics:run',
  TranscriptSearch: 'claude-sessions:search',
  WorktreeList: 'worktree:list',
  WorktreeDiff: 'worktree:diff',
  WorktreeAdd: 'worktree:add',
  WorktreeRemove: 'worktree:remove',
  WorktreeMerge: 'worktree:merge',
  HooksList: 'hooks:list',
  HooksAdd: 'hooks:add',
  HooksRemove: 'hooks:remove',
  ClaudeSessionsList: 'claude-sessions:list',
  ClaudeSessionsDetails: 'claude-sessions:details',
  ClaudeHookEvent: 'claude-hooks:event',
  ObsidianResolveLinks: 'obsidian:resolve-links',
  ObsidianSendDaily: 'obsidian:send-daily',
  ObsidianConfigGet: 'obsidian:config-get',
  ObsidianConfigSet: 'obsidian:config-set',
  ProjectListFiles: 'project:list-files',
} as const;

export interface ProjectCreateInput {
  /** Katalog, w którym powstanie folder projektu. */
  parent: string;
  name: string;
  /** `git init` + pierwszy commit z README — punkty przywracania wymagają repo. */
  initGit: boolean;
}

export type ProjectCreateResult =
  /** `git` mówi, czy repozytorium naprawdę powstało (brak gita nie unieważnia folderu). */
  | { ok: true; path: string; git: boolean }
  | { ok: false; error: 'invalid-name' | 'exists' | 'no-parent' | 'mkdir-failed' };

export type McpAddResult =
  | { ok: true }
  /** `cli` niesie wyjście `claude`, gdy zawiodło z innego powodu niż duplikat. */
  | { ok: false; error: 'exists' | 'claude-missing' | 'failed'; cli?: string };

/** Lista plików projektu (rg --files) — szybkie otwieranie Cmd+P. */
export type ListFilesResult =
  | { ok: true; files: string[]; truncated: boolean }
  | { ok: false; error: string };

export type SendToNoteResult =
  | { ok: true }
  | { ok: false; error: 'not-configured' | 'unreachable' | 'rejected' };

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

/** Import przeciąganiem (M61): wynik kopiowania upuszczonych ścieżek. */
export type ImportPathsResult =
  | { ok: true; copied: number; skipped: ImportSkip[] }
  | { ok: false; error: string };

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

export type RestoreResult =
  | { ok: true; backup: string | null }
  | { ok: false; error: 'not-a-repo' | 'unknown-checkpoint' | 'restore-failed' };

export type SummaryResult =
  | { ok: true; summary: string }
  | { ok: false; error: 'not-a-log' | 'too-short' | 'claude-failed' | 'write-failed' };

export type GlobalSessionLogResult =
  | { ok: true; enabled: boolean; path: string }
  | { ok: false; error: 'settings-unreadable' | 'write-failed' };

export type SkillToggleResult =
  | { ok: true; enabled: boolean }
  | { ok: false; error: 'settings-unreadable' | 'write-failed' };

export interface AgentCreateInput {
  name: string;
  description: string;
  /** Narzędzia po przecinku; puste = wszystkie. */
  tools?: string;
  /** Alias modelu (sonnet/opus/haiku/…); puste = dziedziczy z sesji. */
  model?: string;
  body: string;
}

export interface RuleCreateInput {
  name: string;
  /** Globy po przecinku; puste = reguła ładowana zawsze. */
  paths?: string;
  body: string;
}

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

/** Wynik operacji na worktree (M72). */
export type WorktreeWriteResult =
  | { ok: true; path: string }
  | { ok: false; error: 'invalid-name' | 'exists' | 'dirty' | 'failed'; detail?: string };

export type WorktreeMergeResult =
  | { ok: true; into: string }
  | {
      ok: false;
      error: 'invalid-name' | 'conflict' | 'dirty' | 'failed';
      into: string;
      detail?: string;
    };

/** Warstwa settings, z której pochodzi hook (M70). */
export type HookLayer = 'local' | 'project' | 'user';

export interface HookListEntry {
  event: HookEvent;
  matcher: string;
  command: string;
  layer: HookLayer;
  /** Wpis dziennika sesji wpięty przez Suflera — do wglądu, nie do kasowania. */
  managed: boolean;
}

export type HookWriteResult =
  | { ok: true }
  | { ok: false; error: 'invalid-hook' | 'managed-hook' | 'settings-unreadable' | 'write-failed' };

/** Slash-komenda z `.claude/commands` (M68). */
export interface CommandEntry {
  /** Nazwa wywołania bez ukośnika; podkatalogi jako `przestrzeń:nazwa`. */
  name: string;
  description: string;
  path: string;
  scope: SkillScope;
  /** Frontmatter `argument-hint` — podpowiedź argumentów przy nazwie. */
  argumentHint?: string;
  model?: string;
  allowedTools?: string;
}

export interface SkillsSnapshot {
  projectSkills: SkillEntry[];
  personalSkills: SkillEntry[];
  agents: AgentEntry[];
  rules: RuleEntry[];
  commands: CommandEntry[];
  claudeMd: ClaudeMdEntry[];
}

/** API udostępniane rendererowi przez contextBridge (window.api). */
export interface WindowApi {
  getLayout(): Promise<LayoutState>;
  setLayout(state: LayoutState): Promise<void>;
  /** null → pokaż ekran startowy z wyborem folderu. */
  getProjectRoot(): Promise<string | null>;
  getRecentRoots(): Promise<string[]>;
  /** „Favicon" projektu jako data URI; null → renderer rysuje monogram. */
  getProjectIcon(root: string): Promise<string | null>;
  setProjectRoot(path: string): Promise<boolean>;
  openProjectDialog(): Promise<string | null>;
  /** Tworzy nowy folder roboczy i otwiera go jako projekt (M76). */
  createProject(input: ProjectCreateInput): Promise<ProjectCreateResult>;
  /** Proponowana lokalizacja nowego projektu — obok ostatnio otwartego. */
  getDefaultProjectParent(): Promise<string>;
  /** Wybór lokalizacji nowego projektu (bez zmiany folderu roboczego). */
  chooseProjectParent(): Promise<string | null>;
  /** Ścieżka file:// preloadu dla <webview> podglądu przeglądarki. */
  getWebviewPreloadPath(): Promise<string>;
  readDir(dirPath: string): Promise<ReadDirResult>;
  readFile(filePath: string): Promise<ReadFileResult>;
  /** Obrazek jako data URI — do podglądu w zakładce edytora. */
  readImage(filePath: string): Promise<ReadImageResult>;
  writeFile(filePath: string, content: string): Promise<WriteFileResult>;
  /** Kopiuje upuszczone z systemu ścieżki do katalogu projektu (M61). */
  importPaths(root: string, destDir: string, sources: string[]): Promise<ImportPathsResult>;
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
  /** Dziennik sesji Claude (M52) — automatyczny zapis przebiegu pracy do .md. */
  getSessionLogEnabled(): Promise<boolean>;
  setSessionLogEnabled(enabled: boolean): Promise<boolean>;
  /** Dziennik także dla sesji `claude` poza Suflerem (hooki w ~/.claude/settings.json). */
  getGlobalSessionLog(): Promise<boolean>;
  setGlobalSessionLog(enabled: boolean): Promise<GlobalSessionLogResult>;
  /** Streszcza dziennik przez `claude -p` i wstawia sekcję Podsumowanie. */
  summarizeSessionLog(root: string, path: string): Promise<SummaryResult>;
  /** Punkty przywracania (M55) — migawki drzewa sprzed pracy Claude. */
  listCheckpoints(root: string): Promise<Checkpoint[]>;
  restoreCheckpoint(root: string, hash: string): Promise<RestoreResult>;
  onCheckpointsChanged(listener: () => void): void;
  /** Historia pracy (M56): commity i dzienniki sesji na jednej osi czasu. */
  getWorklog(root: string): Promise<WorklogEntry[]>;
  /** Wyciągnięcie panelu albo karty edytora do osobnego okna (M62). */
  openDetachedWindow(info: DetachedTarget): Promise<void>;
  /** Kreator: nowy plik subagenta w <root>/.claude/agents. */
  createAgent(root: string, input: AgentCreateInput): Promise<SkillCreateResult>;
  /** Kreator: nowy plik reguły w <root>/.claude/rules. */
  createRule(root: string, input: RuleCreateInput): Promise<SkillCreateResult>;
  readMcpConfig(root: string): Promise<McpConfigServer[]>;
  listMcpStatus(root: string): Promise<McpStatusResult>;
  getMcpDetails(root: string, name: string): Promise<McpDetail[]>;
  watchMcp(root: string): Promise<void>;
  /** Dodaje serwer MCP poleceniem `claude mcp add` i odświeża panel (M79). */
  addMcpServer(root: string, input: McpAddInput): Promise<McpAddResult>;
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
  /** Zmiana stanu serwera MCP grafu wiedzy (start/awaria). */
  onWiedzaMcpChanged(listener: () => void): void;
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
  /** Zatwierdzenie zaznaczonych plików z panelu Git (M69). */
  gitCommit(root: string, paths: string[], message: string): Promise<GitCommitResult>;
  /** Szukanie frazy w treści transkryptów projektu (M83). */
  searchTranscripts(root: string, query: string): Promise<SessionHits[]>;
  /** Worktree'y gita — kilka sesji nad jednym zadaniem (M72). */
  listWorktrees(root: string): Promise<Worktree[]>;
  addWorktree(root: string, name: string): Promise<WorktreeWriteResult>;
  /** Co ten worktree wniósł wobec gałęzi bazowej, od punktu rozejścia (M86). */
  diffWorktree(root: string, branch: string, base: string): Promise<BranchDiff | null>;
  removeWorktree(root: string, path: string): Promise<WorktreeWriteResult>;
  mergeWorktree(root: string, branch: string): Promise<WorktreeMergeResult>;
  /** `tsc` + `eslint` na żądanie — diagnostyka bez LSP (M71). */
  runDiagnostics(root: string): Promise<DiagnosticsResult>;
  /** Zużycie tokenów policzone z transkryptów projektu (M73). */
  getUsageHistory(root: string): Promise<UsageScan>;
  /** Hooki Claude Code z trzech warstw settings (M70). */
  listHooks(root: string): Promise<HookListEntry[]>;
  addHook(root: string, entry: HookEntry): Promise<HookWriteResult>;
  removeHook(root: string, layer: HookLayer, entry: HookEntry): Promise<HookWriteResult>;
  /** Zapisane sesje Claude projektu — menu „Wznów sesję" i panel „Sesje". */
  listClaudeSessions(root: string, limit?: number): Promise<ClaudeSessionSummary[]>;
  /** Rozliczenie sesji (liczniki, ostatnie wymiany); null, gdy transkrypt zniknął. */
  getClaudeSessionDetails(root: string, id: string): Promise<ClaudeSessionDetails | null>;
  /** Hooki Notification/Stop sesji Claude → deterministyczny status karty. */
  onClaudeHookEvent(listener: (event: ClaudeHookEvent) => void): void;
  /** Wikilinki: nazwy notatek → ścieżki absolutne w vaultcie (null = brak). */
  resolveNoteLinks(names: string[]): Promise<Record<string, string | null>>;
  /** Zaznaczenie → dopisanie pod nagłówek notatki dziennej (Local REST API). */
  sendToDailyNote(content: string): Promise<SendToNoteResult>;
  getObsidianConfig(): Promise<ObsidianRestConfig>;
  setObsidianConfig(config: ObsidianRestConfig): Promise<ObsidianRestConfig>;
  /** Pliki projektu (ścieżki względne) do szybkiego otwierania Cmd+P. */
  listProjectFiles(root: string): Promise<ListFilesResult>;
}

export type McpStatusResult =
  | { ok: true; entries: McpListEntry[] }
  | { ok: false; error: string };

export interface GitStatusFile {
  /** Ścieżka względem korzenia projektu. */
  path: string;
  state: 'modified' | 'untracked';
}

/** Wynik zatwierdzenia zaznaczonych plików (M69). */
export type GitCommitResult =
  | { ok: true; shortHash: string; files: number }
  | {
      ok: false;
      error:
        | 'not-a-repo'
        | 'nothing-selected'
        | 'empty-message'
        | 'bad-path'
        | 'identity-missing'
        | 'nothing-to-commit'
        | 'commit-failed';
      /** Surowy komunikat gita — tylko dla awarii bez własnego tłumaczenia. */
      detail?: string;
    };

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
