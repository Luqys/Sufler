import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SESSION_LOG_DIR } from '../shared/session-log';
import { countOperations, firstPromptOf, mergeWorklog, type WorklogEntry } from '../shared/worklog';
import { listMarkdownFiles } from './knowledge';
import { runGitLog } from './git-log';

/**
 * Historia pracy (M56): commity gita i dzienniki sesji na jednej osi czasu.
 * Dziennik dostaje datę z frontmattera (`data:`), a gdy jej brak — z nazwy
 * pliku, żeby wpis nie wypadł z osi.
 */

function dateFromLog(markdown: string, path: string): string {
  const fromFrontmatter = /^---\r?\n[\s\S]*?\bdata:\s*([^\n]+)/.exec(markdown)?.[1]?.trim();
  if (fromFrontmatter && !Number.isNaN(Date.parse(fromFrontmatter))) {
    return fromFrontmatter;
  }
  const fromName = /(\d{4}-\d{2}-\d{2})/.exec(path)?.[1];
  return fromName ? `${fromName}T00:00:00.000Z` : '';
}

export async function readWorklog(root: string): Promise<WorklogEntry[]> {
  const entries: WorklogEntry[] = [];

  const log = await runGitLog(root);
  if (log.ok) {
    for (const commit of log.commits.slice(0, 60)) {
      entries.push({
        kind: 'commit',
        date: commit.date,
        title: commit.subject,
        reference: commit.shortHash,
        detail: commit.author,
      });
    }
  }

  const files = await listMarkdownFiles(root);
  for (const file of files) {
    if (!file.path.startsWith(`${SESSION_LOG_DIR}/`)) {
      continue;
    }
    try {
      const markdown = await readFile(join(root, file.path), 'utf8');
      entries.push({
        kind: 'session',
        date: dateFromLog(markdown, file.path),
        title: firstPromptOf(markdown) ?? file.path.split('/').pop() ?? file.path,
        reference: file.path,
        detail: String(countOperations(markdown)),
      });
    } catch {
      // dziennik zniknął w międzyczasie — pomijamy
    }
  }

  return mergeWorklog(entries);
}
