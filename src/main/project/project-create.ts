import { execFile } from 'node:child_process';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname } from 'node:path';
import { promisify } from 'node:util';
import { projectNameProblem, projectTargetPath } from '../../shared/project/project-create';
import type { ProjectCreateResult } from '../../shared/ipc';
import { getRecentRoots, setProjectRoot } from './project';

const execFileAsync = promisify(execFile);

/**
 * Nowy folder roboczy z ekranu startowego (M76). Folder MUSI powstać pusty
 * i nie może przykryć istniejącego katalogu — dlatego `mkdir` bez `recursive`
 * na samym końcu ścieżki i jawny błąd `exists`.
 */
export async function createProject(
  parent: string,
  name: string,
  initGit: boolean,
): Promise<ProjectCreateResult> {
  if (projectNameProblem(name) !== null) {
    return { ok: false, error: 'invalid-name' };
  }
  const target = projectTargetPath(parent, name);
  if (!target) {
    return { ok: false, error: 'invalid-name' };
  }
  try {
    const parentStat = await stat(dirname(target));
    if (!parentStat.isDirectory()) {
      return { ok: false, error: 'no-parent' };
    }
  } catch {
    return { ok: false, error: 'no-parent' };
  }
  try {
    await mkdir(target);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    return { ok: false, error: code === 'EEXIST' ? 'exists' : 'mkdir-failed' };
  }
  if (initGit) {
    try {
      await execFileAsync('git', ['init', '--quiet'], { cwd: target });
      // Pusty katalog roboczy nie ma commita, a bez niego punkty przywracania
      // (M55) nie mają do czego się przyczepić — stąd jeden plik na start.
      await writeFile(`${target}/README.md`, `# ${name.trim()}\n`, 'utf8');
      await execFileAsync('git', ['add', 'README.md'], { cwd: target });
      await execFileAsync('git', ['commit', '--quiet', '-m', 'Początek projektu'], { cwd: target });
    } catch {
      // Brak gita albo brak globalnej tożsamości nie unieważnia folderu —
      // projekt zostaje, tylko bez repozytorium.
      return { ok: true, path: target, git: false };
    }
  }
  return { ok: true, path: target, git: initGit };
}

/** Otwiera nowy projekt jako folder roboczy (z zapisem do „Ostatnich"). */
export function adoptProject(path: string): boolean {
  return setProjectRoot(path);
}

/**
 * Domyślna lokalizacja nowego projektu: katalog obok ostatnio otwartego
 * projektu — tam człowiek trzyma swoje repozytoria. Bez historii: katalog domowy.
 */
export function defaultProjectParent(): string {
  const recent = getRecentRoots()[0];
  return recent ? dirname(recent) : homedir();
}
