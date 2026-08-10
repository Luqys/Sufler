import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { resolveGraphEdges, type GraphGroup, type GraphNode, type KnowledgeGraph } from '../shared/graph';
import { classifyNote, extractTags, TAGS_FALLBACK } from '../shared/knowledge-categories';
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

/**
 * Węzły = notatki .md, krawędzie = linki. Każdy węzeł niesie autora ostatniej
 * zmiany (git) oraz kategorie: funkcję programu i warstwę (frontend/backend).
 */
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

  const count = (map: Map<string, number>, key: string): void => {
    map.set(key, (map.get(key) ?? 0) + 1);
  };
  const toGroups = (map: Map<string, number>): GraphGroup[] =>
    [...map.entries()].map(([name, total]) => ({ name, count: total })).sort((a, b) => b.count - a.count);

  const nodes: GraphNode[] = [];
  const authorCounts = new Map<string, number>();
  const categoryCounts = new Map<string, number>();
  const layerCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();
  for (const file of withContent) {
    const { author, updatedAt } = await lastAuthor(root, file.path);
    const { category, layer } = classifyNote(file.path, file.content);
    const tags = extractTags(file.content);
    nodes.push({
      id: file.path,
      title: (file.path.split('/').pop() ?? file.path).replace(/\.md$/, ''),
      lines: file.lines,
      author,
      updatedAt,
      category,
      layer,
      tags,
    });
    count(authorCounts, author ?? '(niezacommitowane)');
    count(categoryCounts, category);
    count(layerCounts, layer);
    for (const tag of tags.length > 0 ? tags : [TAGS_FALLBACK]) {
      count(tagCounts, tag);
    }
  }

  return {
    nodes,
    edges: resolveGraphEdges(withContent),
    authors: toGroups(authorCounts),
    categories: toGroups(categoryCounts),
    layers: toGroups(layerCounts),
    tags: toGroups(tagCounts),
  };
}
