/**
 * Graf wiedzy à la Obsidian dla plików .md projektu: węzły = notatki,
 * krawędzie = wikilinki [[Nazwa]] i linki markdown [tekst](ścieżka.md).
 * Czysta logika ekstrakcji i rozwiązywania linków — testowana jednostkowo.
 */

export interface GraphNode {
  /** Ścieżka względem korzenia projektu. */
  id: string;
  /** Nazwa notatki (basename bez .md). */
  title: string;
  lines: number;
  /** Autor ostatniej zmiany z gita (null = niezacommitowany). */
  author: string | null;
  /** ISO daty ostatniej zmiany albo null. */
  updatedAt: string | null;
  /** Funkcja programu (frontmatter `kategoria:` albo heurystyka treści). */
  category: string;
  /** Warstwa: Frontend / Backend / Frontend + backend / Ogólna. */
  layer: string;
  /** Tagi z frontmattera (`tagi:`/`tags:`), znormalizowane do małych liter. */
  tags: string[];
}

export interface GraphEdge {
  from: string;
  to: string;
  /** Liczba linków między parą notatek (waga — grubość kreski). */
  count: number;
}

/** Grupa legendy grafu (autor, funkcja programu albo warstwa). */
export interface GraphGroup {
  name: string;
  count: number;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Autorzy posortowani malejąco po liczbie notatek. */
  authors: GraphGroup[];
  /** Funkcje programu posortowane malejąco po liczbie notatek. */
  categories: GraphGroup[];
  /** Warstwy posortowane malejąco po liczbie notatek. */
  layers: GraphGroup[];
  /** Tagi posortowane malejąco po liczbie notatek (z „(bez tagów)"). */
  tags: GraphGroup[];
}

/** Kubełki świeżości notatki wg daty ostatniego commita, od najnowszych. */
export const FRESHNESS_BUCKETS = ['today', 'week', 'month', 'older', 'uncommitted'] as const;
export type FreshnessBucket = (typeof FRESHNESS_BUCKETS)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Kubełek świeżości względem `now`; brak/zły ISO = niezacommitowane. */
export function freshnessBucket(updatedAt: string | null, now: number): FreshnessBucket {
  const time = updatedAt === null ? Number.NaN : Date.parse(updatedAt);
  if (Number.isNaN(time)) {
    return 'uncommitted';
  }
  const age = now - time;
  if (age < DAY_MS) {
    return 'today';
  }
  if (age < 7 * DAY_MS) {
    return 'week';
  }
  if (age < 31 * DAY_MS) {
    return 'month';
  }
  return 'older';
}

/** Surowe cele linków wyciągnięte z treści (bez rozwiązywania). */
export function extractLinkTargets(content: string): string[] {
  const targets: string[] = [];
  // Wikilinki: [[Cel]], [[Cel|alias]], [[Cel#nagłówek]].
  for (const match of content.matchAll(/\[\[([^\]|#\n]+)(?:[#|][^\]]*)?\]\]/g)) {
    const target = match[1]?.trim();
    if (target) {
      targets.push(target);
    }
  }
  // Linki markdown do plików .md (pomijamy URL-e).
  for (const match of content.matchAll(/\]\(([^)\s]+\.md)(?:#[^)]*)?\)/g)) {
    const target = match[1];
    if (target && !/^[a-z]+:\/\//i.test(target)) {
      targets.push(decodeURIComponent(target));
    }
  }
  return targets;
}

function normalizeName(value: string): string {
  return value.toLowerCase().replace(/\.md$/, '');
}

function dirOf(path: string): string {
  const slash = path.lastIndexOf('/');
  return slash === -1 ? '' : path.slice(0, slash);
}

function normalizeRelative(baseDir: string, target: string): string {
  const joined = target.startsWith('/')
    ? target.slice(1)
    : baseDir === ''
      ? target
      : `${baseDir}/${target}`;
  const parts: string[] = [];
  for (const part of joined.split('/')) {
    if (part === '' || part === '.') {
      continue;
    }
    if (part === '..') {
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return parts.join('/');
}

/**
 * Rozwiązuje linki między notatkami: wikilinki po nazwie pliku w całym
 * projekcie (jak Obsidian, bez względu na wielkość liter), linki markdown
 * po ścieżce względnej. Krawędzie deduplikowane jako pary nieskierowane;
 * każdy kolejny link tej samej pary podbija `count` (wagę krawędzi).
 */
export function resolveGraphEdges(
  files: Array<{ path: string; content: string }>,
): GraphEdge[] {
  const byName = new Map<string, string>();
  const byPath = new Map<string, string>();
  for (const file of files) {
    const name = normalizeName(file.path.split('/').pop() ?? file.path);
    if (!byName.has(name)) {
      byName.set(name, file.path);
    }
    byPath.set(normalizeName(file.path), file.path);
  }

  const edges: GraphEdge[] = [];
  const byPair = new Map<string, GraphEdge>();
  for (const file of files) {
    for (const target of extractLinkTargets(file.content)) {
      const normalized = normalizeName(target);
      const resolved =
        byPath.get(normalized) ??
        byPath.get(normalizeName(normalizeRelative(dirOf(file.path), target))) ??
        byName.get(normalized.split('/').pop() ?? normalized);
      if (!resolved || resolved === file.path) {
        continue;
      }
      const key = [file.path, resolved].sort().join('\x00');
      const existing = byPair.get(key);
      if (existing) {
        existing.count += 1;
        continue;
      }
      const edge: GraphEdge = { from: file.path, to: resolved, count: 1 };
      byPair.set(key, edge);
      edges.push(edge);
    }
  }
  return edges;
}

export function polishPlural(
  count: number,
  one: string,
  few: string,
  many: string,
): string {
  if (count === 1) {
    return one;
  }
  const lastTwo = count % 100;
  const last = count % 10;
  if (last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14)) {
    return few;
  }
  return many;
}
