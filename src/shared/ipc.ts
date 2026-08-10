import type { TabKind } from './dock-tabs';
import type { LayoutState } from './layout';

export const IPC = {
  LayoutGet: 'layout:get',
  LayoutSet: 'layout:set',
  ProjectGetRoot: 'project:get-root',
  ProjectOpenDialog: 'project:open-dialog',
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

/** API udostępniane rendererowi przez contextBridge (window.api). */
export interface WindowApi {
  getLayout(): Promise<LayoutState>;
  setLayout(state: LayoutState): Promise<void>;
  getProjectRoot(): Promise<string>;
  openProjectDialog(): Promise<string | null>;
  readDir(dirPath: string): Promise<ReadDirResult>;
  readFile(filePath: string): Promise<ReadFileResult>;
  writeFile(filePath: string, content: string): Promise<WriteFileResult>;
  /** Deklaratywnie ustawia pełną listę obserwowanych plików (otwarte zakładki). */
  watchFiles(paths: string[]): Promise<void>;
  /** Subskrypcja na całe życie okna — bez wypisu (patrz workspace). */
  onWatchEvent(listener: (event: WatchEvent) => void): void;
  ptyCreate(options: { kind: TabKind; cwd: string }): Promise<PtyCreateResult>;
  ptyWrite(ptyId: number, data: string): void;
  ptyResize(ptyId: number, cols: number, rows: number): void;
  ptyKill(ptyId: number): Promise<void>;
  /** Subskrypcje na całe życie okna. */
  onPtyData(listener: (event: PtyDataEvent) => void): void;
  onPtyExit(listener: (event: PtyExitEvent) => void): void;
}
