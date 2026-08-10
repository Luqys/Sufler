import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { resolveGraphEdges, type GraphNode, type KnowledgeGraph } from '../shared/graph';
import { listMarkdownFiles } from './knowledge';

const execFileAsync = promisify(execFile);

async function lastAuthor(
  root: string,
  relPath: string,
): Promise<{ author: string | null; updatedAt: string | null }> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['log', '-1', '--format=%an%x1f%aI', '--', relPath],
      { cwd: root, timeout: 10_000, encoding: 'utf8' },
    );
    const [author, updatedAt] = stdout.trim().split('\x1f');
    return { author: author || null, updatedAt: updatedAt || null };
  } catch {
    return { author: null, updatedAt: null };
  }
}

/** Węzły = notatki .md, krawędzie = linki, kolor = autor ostatniej zmiany (git). */
export async function buildKnowledgeGraph(root: string): Promise<KnowledgeGraph> {
  const files = await listMarkdownFiles(root);
  const withContent: Array<{ path: string; content: string; lines: number }> = [];
  for (const file of files.slice(0, 300)) {
    try {
      withContent.push({
        path: file.path,
        content: await readFile(join(root, file.path), 'utf8'),
        lines: file.lines,
      });
    } catch {
      // plik zniknął — pomijamy
    }
  }

  const nodes: GraphNode[] = [];
  const authorCounts = new Map<string, number>();
  for (const file of withContent) {
    const { author, updatedAt } = await lastAuthor(root, file.path);
    nodes.push({
      id: file.path,
      title: (file.path.split('/').pop() ?? file.path).replace(/\.md$/, ''),
      lines: file.lines,
      author,
      updatedAt,
    });
    const key = author ?? '(niezacommitowane)';
    authorCounts.set(key, (authorCounts.get(key) ?? 0) + 1);
  }

  return {
    nodes,
    edges: resolveGraphEdges(withContent),
    authors: [...authorCounts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count),
  };
}
