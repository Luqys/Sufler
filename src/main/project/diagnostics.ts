import { execFile } from 'node:child_process';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  parseEslintJson,
  parseTscOutput,
  summarize,
  type Diagnostic,
  type DiagnosticsResult,
  type DiagnosticSource,
} from '../../shared/editor/diagnostics';
import { resolveShellEnv } from '../system/shell-env';
import { readState, writeState } from '../window/state-store';

const execFileAsync = promisify(execFile);

/**
 * Uruchamianie `tsc` i `eslint` na żądanie (M71). Świadomie bez trybu
 * `--watch`: na dużym repo to stały koszt CPU, a panel i tak pyta wtedy,
 * kiedy człowiek chce wiedzieć. Oba narzędzia biorą się z `node_modules/.bin`
 * projektu — nie z globalnej instalacji, żeby wersja zgadzała się z repo.
 *
 * Komendy da się nadpisać zmiennymi `VISUALN3O_DIAG_TSC` i
 * `VISUALN3O_DIAG_ESLINT` (ścieżka do binarki) — tak testy e2e podstawiają
 * atrapy z zamrożonym wyjściem zamiast ciągnąć cały toolchain.
 */

/** 90 s starcza na `tsc` w tym repo; dłużej znaczy, że coś stoi. */
const TIMEOUT_MS = 90_000;
const MAX_OUTPUT = 32 * 1024 * 1024;

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

/** Binarka narzędzia: nadpisanie ze środowiska → `node_modules/.bin` → brak. */
async function resolveBin(root: string, source: DiagnosticSource): Promise<string | null> {
  const override = process.env[source === 'tsc' ? 'VISUALN3O_DIAG_TSC' : 'VISUALN3O_DIAG_ESLINT'];
  if (override) {
    return override;
  }
  const local = join(root, 'node_modules', '.bin', source);
  return (await exists(local)) ? local : null;
}

interface ToolRun {
  stdout: string;
  /** Ustawione, gdy narzędzie w ogóle nie wystartowało. */
  failure: string | null;
}

async function runTool(root: string, bin: string, args: string[]): Promise<ToolRun> {
  try {
    const { stdout } = await execFileAsync(bin, args, {
      cwd: root,
      timeout: TIMEOUT_MS,
      maxBuffer: MAX_OUTPUT,
      encoding: 'utf8',
      env: { ...(await resolveShellEnv()), ...process.env },
    });
    return { stdout, failure: null };
  } catch (error) {
    // Niezerowy kod wyjścia to normalna droga obu narzędzi, gdy znajdą błędy —
    // wynik jest wtedy na stdout i to on nas interesuje.
    const shell = error as { stdout?: string; stderr?: string; message?: string; killed?: boolean };
    if (typeof shell.stdout === 'string' && shell.stdout.trim() !== '') {
      return { stdout: shell.stdout, failure: null };
    }
    const detail = (shell.stderr ?? shell.message ?? '').trim();
    return {
      stdout: '',
      failure: shell.killed === true ? 'timeout' : detail.slice(0, 300) || 'nie-uruchomiono',
    };
  }
}

export async function runDiagnostics(root: string): Promise<DiagnosticsResult> {
  const items: Diagnostic[] = [];
  const failed: DiagnosticsResult['failed'] = [];

  const tscBin = await resolveBin(root, 'tsc');
  if (tscBin === null) {
    failed.push({ source: 'tsc', message: 'brak-narzedzia' });
  } else {
    const run = await runTool(root, tscBin, ['--noEmit', '--pretty', 'false']);
    if (run.failure !== null) {
      failed.push({ source: 'tsc', message: run.failure });
    } else {
      items.push(...parseTscOutput(run.stdout, root));
    }
  }

  const eslintBin = await resolveBin(root, 'eslint');
  if (eslintBin === null) {
    failed.push({ source: 'eslint', message: 'brak-narzedzia' });
  } else {
    const run = await runTool(root, eslintBin, ['.', '--format', 'json']);
    if (run.failure !== null) {
      failed.push({ source: 'eslint', message: run.failure });
    } else {
      items.push(...parseEslintJson(run.stdout, root));
    }
  }

  return summarize(items, failed);
}

/** Przełącznik „sprawdzaj po zapisie" (M90); domyślnie wyłączony. */
export function isDiagnosticsAuto(): boolean {
  return readState().diagnosticsAuto === true;
}

export function setDiagnosticsAuto(enabled: boolean): boolean {
  writeState({ ...readState(), diagnosticsAuto: enabled });
  return enabled;
}
