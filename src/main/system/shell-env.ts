import { execFile } from 'node:child_process';
import { pathDelimiter, type Platform } from '../../shared/system/exec-path';

const PLATFORM: Platform = process.platform === 'win32' ? 'win32' : 'posix';

/**
 * Znane ryzyko: Electron uruchomiony z Findera nie dziedziczy PATH
 * z ~/.zshrc. Rozwiązujemy raz przy starcie: logowany, interaktywny shell
 * wypisuje swoje środowisko (env -0, wpisy rozdzielone NUL-ami, po markerze —
 * rc-pliki potrafią śmiecić na stdout).
 */

const MARKER = '__VN3O_ENV_START__';
let cached: Promise<Record<string, string>> | null = null;

export function parseShellEnvOutput(output: string): Record<string, string> {
  const markerIndex = output.lastIndexOf(MARKER);
  const payload = markerIndex === -1 ? output : output.slice(markerIndex + MARKER.length);
  const env: Record<string, string> = {};
  for (const entry of payload.split('\0')) {
    const trimmed = entry.replace(/^\n+/, '');
    if (!trimmed) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq <= 0) {
      continue;
    }
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

/** Hak testowy (e2e): katalog z atrapami binarek doklejany na początek PATH. */
function applyPathPrepend(env: Record<string, string>): Record<string, string> {
  const prepend = process.env['VISUALN3O_PATH_PREPEND'];
  if (prepend) {
    // Separator zależy od systemu — na Windowsie dwukropek scaliłby ścieżki
    // w jedną, nieistniejącą (M78).
    env['PATH'] = `${prepend}${pathDelimiter(PLATFORM)}${env['PATH'] ?? ''}`;
  }
  return env;
}

export function resolveShellEnv(): Promise<Record<string, string>> {
  if (cached) {
    return cached;
  }
  // Windows nie ma logowanej powłoki z rc-plikami: `cmd.exe` dziedziczy PATH
  // z systemu, a próba `zsh -ilc` kończy się błędem i sekundami zwłoki (M78).
  if (PLATFORM === 'win32') {
    cached = Promise.resolve(applyPathPrepend({ ...process.env } as Record<string, string>));
    return cached;
  }
  cached = new Promise((resolve) => {
    const shell = process.env['SHELL'] || '/bin/zsh';
    const fallback = (): void =>
      resolve(applyPathPrepend({ ...process.env } as Record<string, string>));
    const child = execFile(
      shell,
      ['-ilc', `printf '%s' '${MARKER}'; env -0`],
      { timeout: 4000, maxBuffer: 1024 * 1024 },
      (error, stdout) => {
        if (error || !stdout.includes(MARKER)) {
          fallback();
          return;
        }
        const parsed = parseShellEnvOutput(stdout);
        if (!parsed['PATH']) {
          fallback();
          return;
        }
        resolve(applyPathPrepend({ ...(process.env as Record<string, string>), ...parsed }));
      },
    );
    child.on('error', fallback);
  });
  return cached;
}
