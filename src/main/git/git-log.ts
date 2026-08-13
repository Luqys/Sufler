import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { GitCommit, GitCommitFile, GitLogResult } from '../../shared/ipc';

const execFileAsync = promisify(execFile);

const FIELD_SEP = '\x1f';
const RECORD_SEP = '\x1e';

/** Format: %H\x1f%P\x1f%an\x1f%aI\x1f%s\x1f%b\x1e — separatory sterujące nie występują w treści. */
export function parseGitLog(stdout: string): GitCommit[] {
  const commits: GitCommit[] = [];
  for (const record of stdout.split(RECORD_SEP)) {
    const trimmed = record.replace(/^\n/, '');
    if (!trimmed) {
      continue;
    }
    const [hash, parents, author, date, subject, body] = trimmed.split(FIELD_SEP);
    if (!hash || !author || !date) {
      continue;
    }
    commits.push({
      hash,
      shortHash: hash.slice(0, 7),
      parents: (parents ?? '').split(' ').filter(Boolean),
      author,
      date,
      subject: subject ?? '',
      body: (body ?? '').trim(),
    });
  }
  return commits;
}

/** `diff-tree --name-status -z`: STATUS\0ścieżka\0 (rename: STATUS\0stara\0nowa\0). */
export function parseNameStatusZ(stdout: string): GitCommitFile[] {
  const files: GitCommitFile[] = [];
  const tokens = stdout.split('\0');
  for (let i = 0; i < tokens.length - 1; i++) {
    const status = tokens[i];
    if (!status || !/^[AMDRCTUX]/.test(status)) {
      continue;
    }
    const first = tokens[i + 1];
    if (!first) {
      continue;
    }
    if (status.startsWith('R') || status.startsWith('C')) {
      const renamed = tokens[i + 2];
      files.push({ status: status[0] ?? 'R', path: renamed ?? first });
      i += 2;
    } else {
      files.push({ status: status[0] ?? 'M', path: first });
      i += 1;
    }
  }
  return files;
}

async function runGit(root: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, {
    cwd: root,
    timeout: 15_000,
    maxBuffer: 8 * 1024 * 1024,
    encoding: 'utf8',
  });
  return stdout;
}

export async function runGitLog(root: string): Promise<GitLogResult> {
  try {
    const branch = (await runGit(root, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
    const stdout = await runGit(root, [
      'log',
      '--max-count=100',
      `--pretty=format:%H${FIELD_SEP}%P${FIELD_SEP}%an${FIELD_SEP}%aI${FIELD_SEP}%s${FIELD_SEP}%b${RECORD_SEP}`,
    ]);
    return { ok: true, branch, commits: parseGitLog(stdout) };
  } catch {
    return { ok: false };
  }
}

export async function runGitShowCommit(root: string, hash: string): Promise<GitCommitFile[]> {
  if (!/^[0-9a-f]{7,40}$/i.test(hash)) {
    return [];
  }
  try {
    const stdout = await runGit(root, [
      'diff-tree',
      '--no-commit-id',
      '--name-status',
      '-r',
      '--root',
      '-z',
      hash,
    ]);
    return parseNameStatusZ(stdout);
  } catch {
    return [];
  }
}
