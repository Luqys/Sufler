import { execFile } from 'node:child_process';

/**
 * Ryzyko nr 1 ze SPEC.md: Electron uruchomiony z Findera nie dziedziczy PATH
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

export function resolveShellEnv(): Promise<Record<string, string>> {
  if (cached) {
    return cached;
  }
  cached = new Promise((resolve) => {
    const shell = process.env['SHELL'] || '/bin/zsh';
    const fallback = (): void => resolve({ ...process.env } as Record<string, string>);
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
        resolve({ ...(process.env as Record<string, string>), ...parsed });
      },
    );
    child.on('error', fallback);
  });
  return cached;
}
