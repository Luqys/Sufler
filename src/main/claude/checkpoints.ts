import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  CHECKPOINT_REF,
  checkpointSubject,
  parseCheckpointLog,
  type Checkpoint,
} from '../../shared/git/checkpoints';

const execFileAsync = promisify(execFile);

/**
 * Migawki drzewa roboczego w refs/sufler/checkpoints (M55). Cała operacja
 * idzie przez tymczasowy indeks (GIT_INDEX_FILE), więc indeks użytkownika
 * i HEAD zostają nietknięte — aplikacja nigdy nie zmienia stanu repozytorium
 * pod palcami pracującego człowieka.
 */

async function git(root: string, args: string[], env?: Record<string, string>): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd: root,
    timeout: 20_000,
    maxBuffer: 16 * 1024 * 1024,
    encoding: 'utf8',
    env: env ? { ...process.env, ...env } : process.env,
  });
  return stdout;
}

async function isRepo(root: string): Promise<boolean> {
  try {
    await git(root, ['rev-parse', '--git-dir']);
    return true;
  } catch {
    return false;
  }
}

async function refHash(root: string): Promise<string | null> {
  try {
    return (await git(root, ['rev-parse', CHECKPOINT_REF])).trim();
  } catch {
    return null;
  }
}

/**
 * Tworzy migawkę bieżącego drzewa. Zwraca hash albo null, gdy nic się nie
 * zmieniło od poprzedniej migawki (albo projekt nie jest repozytorium).
 */
export async function createCheckpoint(root: string, label: string): Promise<string | null> {
  if (!(await isRepo(root))) {
    return null;
  }
  const dir = await mkdtemp(join(tmpdir(), 'sufler-ckpt-'));
  const indexFile = join(dir, 'index');
  try {
    const env = { GIT_INDEX_FILE: indexFile };
    // Świeży indeks z HEAD (albo pusty w repo bez commitów) + całe drzewo.
    try {
      await git(root, ['read-tree', 'HEAD'], env);
    } catch {
      await git(root, ['read-tree', '--empty'], env);
    }
    await git(root, ['add', '-A', '--', '.'], env);
    const tree = (await git(root, ['write-tree'], env)).trim();

    const parent = await refHash(root);
    if (parent) {
      const parentTree = (await git(root, ['rev-parse', `${parent}^{tree}`])).trim();
      if (parentTree === tree) {
        return null; // nic nowego — nie mnożymy pustych migawek
      }
    }
    const args = ['commit-tree', tree, '-m', checkpointSubject(label)];
    if (parent) {
      args.push('-p', parent);
    }
    const hash = (
      await git(root, args, {
        GIT_AUTHOR_NAME: 'Sufler',
        GIT_AUTHOR_EMAIL: 'sufler@localhost',
        GIT_COMMITTER_NAME: 'Sufler',
        GIT_COMMITTER_EMAIL: 'sufler@localhost',
      })
    ).trim();
    await git(root, ['update-ref', CHECKPOINT_REF, hash]);
    return hash;
  } catch {
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function listCheckpoints(root: string, limit = 30): Promise<Checkpoint[]> {
  try {
    const stdout = await git(root, [
      'log',
      `--max-count=${limit}`,
      '--format=%H%x1f%aI%x1f%s',
      CHECKPOINT_REF,
    ]);
    return parseCheckpointLog(stdout);
  } catch {
    return [];
  }
}

export type RestoreResult =
  | { ok: true; backup: string | null }
  | { ok: false; error: 'not-a-repo' | 'unknown-checkpoint' | 'restore-failed' };

/**
 * Przywraca drzewo z migawki. Bieżący stan trafia najpierw do świeżej
 * migawki, więc „cofnij" samo jest odwracalne.
 */
export async function restoreCheckpoint(root: string, hash: string): Promise<RestoreResult> {
  if (!(await isRepo(root))) {
    return { ok: false, error: 'not-a-repo' };
  }
  try {
    await git(root, ['cat-file', '-e', `${hash}^{commit}`]);
  } catch {
    return { ok: false, error: 'unknown-checkpoint' };
  }
  const backup = await createCheckpoint(root, 'stan przed przywróceniem');
  try {
    // Pliki z migawki wracają na dysk; indeks użytkownika zostaje nietknięty.
    await git(root, ['checkout', hash, '--', '.']);
    return { ok: true, backup };
  } catch {
    return { ok: false, error: 'restore-failed' };
  }
}
