/**
 * Wybór komendy startowej pseudoterminala na różnych systemach (M78).
 *
 * Na Windowsie zgłoszony błąd „Nie udało się uruchomić `claude`: File not found"
 * ma trzy przyczyny naraz:
 *  1. `claude` z npm to `claude.cmd` (shim), a `CreateProcess` nie uruchamia
 *     plików wsadowych — trzeba przez `cmd.exe /c`;
 *  2. rozwiązywanie nazwy wymaga PATHEXT, nie samego PATH;
 *  3. domyślna powłoka `/bin/zsh` nie istnieje — jest `COMSPEC`.
 *
 * Czysta logika (bez `fs` i bez `process`) — testowana jednostkowo dla obu
 * systemów niezależnie od tego, na czym akurat lecą testy.
 */

export type Platform = 'win32' | 'posix';

export interface SpawnPlan {
  /** Plik do uruchomienia. */
  command: string;
  args: string[];
}

/** Separator listy katalogów w PATH. */
export function pathDelimiter(platform: Platform): string {
  return platform === 'win32' ? ';' : ':';
}

export function pathDirs(pathValue: string | undefined, platform: Platform): string[] {
  return (pathValue ?? '')
    .split(pathDelimiter(platform))
    .map((dir) => dir.trim().replace(/^"|"$/g, ''))
    .filter((dir) => dir !== '');
}

/**
 * Rozszerzenia wykonywalne z PATHEXT (Windows). Kolejność ma znaczenie:
 * `.exe` przed `.cmd`, bo plik wykonywalny da się uruchomić wprost.
 */
export function windowsExtensions(pathext: string | undefined): string[] {
  /** Tylko te rozszerzenia umiemy uruchomić (patrz `spawnPlanFor`), w tej kolejności. */
  const supported = ['.exe', '.cmd', '.bat', '.com', '.ps1'];
  const declared = new Set(
    (pathext ?? '')
      .split(';')
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => entry.startsWith('.')),
  );
  if (declared.size === 0) {
    return supported;
  }
  // Przecięcie z PATHEXT: `.vbs` czy `.js` z listy systemu nic by nam nie dały,
  // a `.ps1` bywa poza PATHEXT, choć shim npm-a właśnie taki tworzy.
  const fromSystem = supported.filter((extension) => declared.has(extension));
  return fromSystem.includes('.ps1') ? fromSystem : [...fromSystem, '.ps1'];
}

/** Ścieżki, pod którymi może leżeć komenda — do sprawdzenia po kolei. */
export function executableCandidates(
  command: string,
  env: Record<string, string | undefined>,
  platform: Platform,
): string[] {
  const separator = platform === 'win32' ? '\\' : '/';
  // Ścieżka podana wprost (zawiera separator) nie szuka się w PATH.
  const explicit = command.includes('/') || (platform === 'win32' && command.includes('\\'));
  const dirs = explicit ? [''] : pathDirs(env['PATH'] ?? env['Path'], platform);
  const extensions =
    platform === 'win32' && !/\.[a-z0-9]+$/i.test(command)
      ? windowsExtensions(env['PATHEXT'])
      : [''];
  const candidates: string[] = [];
  for (const dir of dirs) {
    const base = dir === '' ? command : `${dir.replace(/[\\/]+$/, '')}${separator}${command}`;
    for (const extension of extensions) {
      candidates.push(`${base}${extension}`);
    }
  }
  return candidates;
}

/** Powłoka dla zakładek `terminal`. */
export function defaultShell(
  env: Record<string, string | undefined>,
  platform: Platform,
): string {
  if (platform === 'win32') {
    return env['COMSPEC'] ?? 'cmd.exe';
  }
  return env['SHELL'] ?? '/bin/zsh';
}

/** Nazwa powłoki na zakładkę (bez ścieżki i rozszerzenia). */
export function shellTitle(shell: string): string {
  const base = shell.split(/[\\/]/).pop() ?? shell;
  return base.replace(/\.(exe|cmd|bat|com)$/i, '');
}

/**
 * Plan uruchomienia rozwiązanej komendy. Pliki wsadowe Windowsa muszą przejść
 * przez `cmd.exe /d /s /c` — inaczej ConPTY zwraca „File not found".
 */
export function spawnPlanFor(
  resolved: string,
  args: string[],
  env: Record<string, string | undefined>,
  platform: Platform,
): SpawnPlan {
  if (platform === 'win32' && /\.(cmd|bat)$/i.test(resolved)) {
    return {
      command: env['COMSPEC'] ?? 'cmd.exe',
      args: ['/d', '/s', '/c', resolved, ...args],
    };
  }
  if (platform === 'win32' && /\.ps1$/i.test(resolved)) {
    return {
      command: 'powershell.exe',
      args: ['-NoLogo', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', resolved, ...args],
    };
  }
  return { command: resolved, args };
}
