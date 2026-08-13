import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  FRESHNESS_BUCKETS,
  freshnessBucket,
  type FreshnessBucket,
  type GraphGroup,
  type GraphNode,
  type KnowledgeGraph,
} from '../../../../shared/knowledge/graph';
import { createLayout, tick, type GraphLayout } from '../../../../shared/knowledge/graph-layout';
import type { StringKey } from '../../../../shared/i18n';
import {
  CATEGORY_FALLBACK,
  LAYER_BACKEND,
  LAYER_BOTH,
  LAYER_FRONTEND,
  LAYER_NONE,
  TAGS_FALLBACK,
} from '../../../../shared/knowledge/knowledge-categories';
import { getLocale, tf, tp, useT } from '../../i18n';
import { onKnowledgeChanged } from '../../knowledge-events';
import { useWorkspace } from '../../workspace';

/** Paleta grup (stała, niezależna od motywu). */
const GROUP_COLORS = [
  '#d97757',
  '#2563eb',
  '#16a34a',
  '#a855f7',
  '#db2777',
  '#0891b2',
  '#f59e0b',
  '#64748b',
];

/**
 * Wartownik grupy „bez autora" — musi być identyczny z literałem, który
 * main/knowledge-graph.ts wstawia jako nazwę grupy (wartość techniczna,
 * nie do tłumaczenia; w legendzie wyświetlana jako t('graph.uncommitted')).
 */
const UNCOMMITTED = '(niezacommitowane)';
const NEUTRAL_COLOR = '#9ca3af';

/** Tryb kolorowania węzłów: autor / funkcja / warstwa / tagi / świeżość. */
type ColorMode = 'author' | 'category' | 'layer' | 'tags' | 'fresh';

const MODES: Array<{ id: ColorMode; labelKey: StringKey; testId: string }> = [
  { id: 'author', labelKey: 'graph.modeAuthor', testId: 'graph-mode-author' },
  { id: 'category', labelKey: 'graph.modeCategory', testId: 'graph-mode-category' },
  { id: 'layer', labelKey: 'graph.modeLayer', testId: 'graph-mode-layer' },
  { id: 'tags', labelKey: 'graph.modeTags', testId: 'graph-mode-tags' },
  { id: 'fresh', labelKey: 'graph.modeFresh', testId: 'graph-mode-fresh' },
];

const MODE_TITLE_KEYS: Record<ColorMode, StringKey> = {
  author: 'graph.titleAuthor',
  category: 'graph.titleCategory',
  layer: 'graph.titleLayer',
  tags: 'graph.titleTags',
  fresh: 'graph.titleFresh',
};

/** Stałe kolory warstw — te same w każdym projekcie. */
const LAYER_COLORS: Record<string, string> = {
  [LAYER_FRONTEND]: '#2563eb',
  [LAYER_BACKEND]: '#16a34a',
  [LAYER_BOTH]: '#a855f7',
  [LAYER_NONE]: NEUTRAL_COLOR,
};

/** Stałe kolory świeżości — od zieleni (dziś) po szarość (starsze). */
const FRESH_COLORS: Record<FreshnessBucket, string> = {
  today: '#16a34a',
  week: '#84cc16',
  month: '#f59e0b',
  older: '#64748b',
  uncommitted: NEUTRAL_COLOR,
};

const FRESH_LABEL_KEYS: Record<FreshnessBucket, StringKey> = {
  today: 'graph.freshToday',
  week: 'graph.freshWeek',
  month: 'graph.freshMonth',
  older: 'graph.freshOlder',
  uncommitted: 'graph.uncommitted',
};

/**
 * Aktywny podział węzłów na grupy: tytuł legendy, grupy, kolory i klucze
 * węzła (w trybie tagów notatka należy do wielu grup naraz — kolor bierze
 * z pierwszej, filtr dopasowuje którąkolwiek).
 */
interface Grouping {
  titleKey: StringKey;
  groups: GraphGroup[];
  colors: Map<string, string>;
  keysOf: (node: GraphNode) => string[];
}

interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Graf wiedzy à la Obsidian: notatki .md jako węzły, linki jako krawędzie
 * (grubość = liczba linków między parą). Kolor węzła zależy od trybu: autor
 * ostatniej zmiany (git), funkcja programu, warstwa frontend/backend, tagi
 * z frontmattera albo świeżość; klik w wiersz legendy filtruje grupę.
 * Szukajka podświetla dopasowania, przełącznik chowa notatki bez połączeń.
 * Układ liczony jest od razu do stabilnego stanu (bez animacji „rozbiegania
 * się"), a widok dopasowuje się do zawartości. Klik = szczegóły i powiązania,
 * podwójny klik = otwarcie.
 */
export function GraphView(): ReactElement {
  const t = useT();
  const { root, openFile } = useWorkspace();
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<ColorMode>('author');
  /** Nazwa grupy z legendy, do której zawężony jest graf (null = wszystko). */
  const [filter, setFilter] = useState<string | null>(null);
  /** Zapytanie szukajki — dopasowania świecą, reszta gaśnie. */
  const [query, setQuery] = useState('');
  /** Ukrywanie notatek bez żadnych połączeń (osieroconych). */
  const [hideOrphans, setHideOrphans] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef<GraphLayout | null>(null);
  const transformRef = useRef<ViewTransform>({ scale: 1, offsetX: 0, offsetY: 0 });
  const hoverRef = useRef<string | null>(null);
  const selectedRef = useRef<string | null>(null);
  const dragNodeRef = useRef<string | null>(null);
  const panRef = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);
  const energyRef = useRef(0);
  // Pozycje sprzed odświeżenia — auto-aktualizacja nie przetasowuje grafu.
  const seedPositionsRef = useRef<Map<string, { x: number; y: number }> | null>(null);

  const select = useCallback((id: string | null): void => {
    selectedRef.current = id;
    setSelected(id);
  }, []);

  const refresh = useCallback(() => {
    const previous = layoutRef.current;
    seedPositionsRef.current = previous
      ? new Map([...previous.nodes.values()].map((node) => [node.id, { x: node.x, y: node.y }]))
      : null;
    void window.api.getKnowledgeGraph(root).then((data) => {
      layoutRef.current = null;
      setGraph(data);
      if (selectedRef.current && !data.nodes.some((node) => node.id === selectedRef.current)) {
        selectedRef.current = null;
        setSelected(null);
      }
    });
  }, [root]);

  useEffect(() => {
    refresh();
    void window.api.watchKnowledge(root);
    return onKnowledgeChanged(refresh);
  }, [refresh, root]);

  // Kubełki świeżości liczone raz na odświeżenie grafu (zależą od „teraz").
  const freshOf = useMemo(() => {
    const now = Date.now();
    return new Map(
      (graph?.nodes ?? []).map((node) => [node.id, freshnessBucket(node.updatedAt, now)]),
    );
  }, [graph]);

  const grouping = useMemo<Grouping>(() => {
    const groups = !graph
      ? []
      : mode === 'author'
        ? graph.authors
        : mode === 'category'
          ? graph.categories
          : mode === 'layer'
            ? graph.layers
            : mode === 'tags'
              ? graph.tags
              : FRESHNESS_BUCKETS.map((bucket) => ({
                  name: bucket as string,
                  count: [...freshOf.values()].filter((value) => value === bucket).length,
                })).filter((group) => group.count > 0);
    const colors = new Map<string, string>();
    let slot = 0;
    for (const group of groups) {
      const fixed =
        mode === 'layer'
          ? LAYER_COLORS[group.name]
          : mode === 'fresh'
            ? FRESH_COLORS[group.name as FreshnessBucket]
            : undefined;
      const neutral =
        (mode === 'author' && group.name === UNCOMMITTED) ||
        (mode === 'category' && group.name === CATEGORY_FALLBACK) ||
        (mode === 'tags' && group.name === TAGS_FALLBACK);
      colors.set(
        group.name,
        fixed ??
          (neutral ? NEUTRAL_COLOR : (GROUP_COLORS[slot++ % GROUP_COLORS.length] ?? NEUTRAL_COLOR)),
      );
    }
    const keysOf = (node: GraphNode): string[] =>
      mode === 'author'
        ? [node.author ?? UNCOMMITTED]
        : mode === 'category'
          ? [node.category]
          : mode === 'layer'
            ? [node.layer]
            : mode === 'tags'
              ? node.tags.length > 0
                ? node.tags
                : [TAGS_FALLBACK]
              : [freshOf.get(node.id) ?? 'uncommitted'];
    return { titleKey: MODE_TITLE_KEYS[mode], groups, colors, keysOf };
  }, [graph, mode, freshOf]);

  const switchMode = useCallback((next: ColorMode): void => {
    setMode(next);
    setFilter(null);
  }, []);

  // Po odświeżeniu grafu filtr na nieistniejącą już grupę znika.
  useEffect(() => {
    if (filter !== null && !grouping.groups.some((group) => group.name === filter)) {
      setFilter(null);
    }
  }, [filter, grouping]);

  /** Stopień węzła (liczba krawędzi) — do ukrywania osieroconych. */
  const degrees = useMemo(() => {
    const map = new Map<string, number>();
    for (const edge of graph?.edges ?? []) {
      map.set(edge.from, (map.get(edge.from) ?? 0) + 1);
      map.set(edge.to, (map.get(edge.to) ?? 0) + 1);
    }
    return map;
  }, [graph]);

  const hiddenOrphans = useMemo(() => {
    if (!hideOrphans || !graph) {
      return new Set<string>();
    }
    return new Set(
      graph.nodes.filter((node) => (degrees.get(node.id) ?? 0) === 0).map((node) => node.id),
    );
  }, [graph, degrees, hideOrphans]);

  // Ukrycie zaznaczonego sierotki zamyka też jego szczegóły.
  useEffect(() => {
    if (selected && hiddenOrphans.has(selected)) {
      select(null);
    }
  }, [selected, hiddenOrphans, select]);

  /** Identyfikatory dopasowań szukajki (null = szukajka pusta). */
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (needle === '' || !graph) {
      return null;
    }
    return new Set(
      graph.nodes
        .filter((node) => !hiddenOrphans.has(node.id))
        .filter(
          (node) =>
            node.title.toLowerCase().includes(needle) || node.id.toLowerCase().includes(needle),
        )
        .map((node) => node.id),
    );
  }, [graph, query, hiddenOrphans]);

  const hiddenRef = useRef<Set<string>>(new Set());
  hiddenRef.current = hiddenOrphans;

  /** Enter w szukajce zaznacza pierwsze dopasowanie (alfabetycznie). */
  const submitSearch = (): void => {
    if (!graph || !matches || matches.size === 0) {
      return;
    }
    const first = graph.nodes
      .filter((node) => matches.has(node.id))
      .sort((a, b) => a.title.localeCompare(b.title, getLocale(), { sensitivity: 'base' }))[0];
    if (first) {
      select(first.id);
    }
  };

  // Pętla rysowania; symulacja tyka tylko przy przeciąganiu węzła.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !graph) {
      return;
    }
    let raf = 0;
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const neighborSets = new Map<string, Set<string>>();
    for (const edge of graph.edges) {
      (neighborSets.get(edge.from) ?? neighborSets.set(edge.from, new Set()).get(edge.from))?.add(
        edge.to,
      );
      (neighborSets.get(edge.to) ?? neighborSets.set(edge.to, new Set()).get(edge.to))?.add(
        edge.from,
      );
    }
    const degree = (id: string): number => neighborSets.get(id)?.size ?? 0;

    const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
    const passesFilter = (id: string): boolean => {
      if (matches !== null && !matches.has(id)) {
        return false;
      }
      if (filter === null) {
        return true;
      }
      const node = nodeById.get(id);
      return node ? grouping.keysOf(node).includes(filter) : true;
    };

    /** Dopasowanie widoku do zawartości (padding na etykiety). */
    const fitView = (layout: GraphLayout, width: number, height: number): void => {
      const nodes = [...layout.nodes.values()];
      if (nodes.length === 0) {
        return;
      }
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const node of nodes) {
        minX = Math.min(minX, node.x);
        minY = Math.min(minY, node.y);
        maxX = Math.max(maxX, node.x);
        maxY = Math.max(maxY, node.y);
      }
      const pad = 90;
      const boxW = Math.max(1, maxX - minX + pad * 2);
      const boxH = Math.max(1, maxY - minY + pad * 2);
      const scale = Math.min(1.4, Math.max(0.3, Math.min(width / boxW, height / boxH)));
      transformRef.current = {
        scale,
        offsetX: width / 2 - ((minX + maxX) / 2) * scale,
        offsetY: height / 2 - ((minY + maxY) / 2) * scale,
      };
    };

    const draw = (): void => {
      const parent = canvas.parentElement;
      if (!parent) {
        return;
      }
      const width = parent.clientWidth;
      const height = parent.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
      if (!layoutRef.current && width > 0) {
        const layout = createLayout(
          graph.nodes.map((node) => node.id),
          graph.edges,
          width,
          height,
        );
        const seeds = seedPositionsRef.current;
        let seeded = 0;
        if (seeds) {
          for (const node of layout.nodes.values()) {
            const seed = seeds.get(node.id);
            if (seed) {
              node.x = seed.x;
              node.y = seed.y;
              seeded += 1;
            }
          }
        }
        // Układ liczony na zimno do stabilności — bez widowiskowego chaosu.
        const steps = seeded > 0 && seeded === layout.nodes.size ? 120 : 340;
        for (let i = 0; i < steps; i += 1) {
          tick(layout);
        }
        layoutRef.current = layout;
        fitView(layout, width, height);
      }
      const layout = layoutRef.current;
      if (!layout) {
        raf = requestAnimationFrame(draw);
        return;
      }
      if (energyRef.current > 0) {
        tick(layout, dragNodeRef.current ?? undefined);
        energyRef.current -= 1;
      }

      const styles = getComputedStyle(document.documentElement);
      const textColor = styles.getPropertyValue('--text').trim() || '#333';
      const mutedColor = styles.getPropertyValue('--muted').trim() || '#888';
      const bgColor = styles.getPropertyValue('--bg').trim() || '#fff';
      const accentColor = styles.getPropertyValue('--accent').trim() || '#d97757';

      const { scale, offsetX, offsetY } = transformRef.current;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.fillStyle = bgColor;
      context.fillRect(0, 0, width, height);
      context.translate(offsetX, offsetY);
      context.scale(scale, scale);

      const focus = hoverRef.current ?? selectedRef.current;
      const focusNeighbors = focus ? (neighborSets.get(focus) ?? new Set()) : null;

      for (const edge of layout.edges) {
        const a = layout.nodes.get(edge.from);
        const b = layout.nodes.get(edge.to);
        if (!a || !b) {
          continue;
        }
        const active = focus !== null && (edge.from === focus || edge.to === focus);
        const filteredOut = !passesFilter(edge.from) || !passesFilter(edge.to);
        context.strokeStyle = active ? accentColor : mutedColor;
        context.globalAlpha = filteredOut ? 0.05 : focus === null ? 0.35 : active ? 0.8 : 0.08;
        // Grubość = waga krawędzi (liczba linków między parą notatek).
        context.lineWidth = 1 + Math.min(1.6, (edge.count - 1) * 0.7) + (active ? 0.6 : 0);
        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.stroke();
      }

      for (const node of graph.nodes) {
        const position = layout.nodes.get(node.id);
        if (!position || hiddenOrphans.has(node.id)) {
          continue;
        }
        const filteredOut = !passesFilter(node.id);
        const dimmed =
          filteredOut ||
          (focus !== null && node.id !== focus && !(focusNeighbors?.has(node.id) ?? false));
        const radius = 5 + Math.min(7, degree(node.id) * 1.4);
        context.globalAlpha = filteredOut ? 0.12 : dimmed ? 0.18 : 1;
        context.fillStyle =
          grouping.colors.get(grouping.keysOf(node)[0] ?? '') ?? NEUTRAL_COLOR;
        context.beginPath();
        context.arc(position.x, position.y, radius, 0, Math.PI * 2);
        context.fill();
        if (node.id === selectedRef.current) {
          context.strokeStyle = accentColor;
          context.lineWidth = 2.2;
          context.stroke();
        } else if (node.id === hoverRef.current) {
          context.strokeStyle = textColor;
          context.lineWidth = 1.5;
          context.stroke();
        } else if (matches !== null && matches.has(node.id)) {
          // Pierścień dopasowania szukajki.
          context.strokeStyle = accentColor;
          context.lineWidth = 1.4;
          context.stroke();
        }
        context.fillStyle = dimmed ? mutedColor : textColor;
        context.font = `${node.id === focus ? 600 : 400} 10.5px -apple-system, sans-serif`;
        context.textAlign = 'center';
        context.fillText(node.title, position.x, position.y + radius + 12);
      }
      context.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [graph, grouping, filter, matches, hiddenOrphans]);

  const toWorld = (event: { clientX: number; clientY: number }): { x: number; y: number } => {
    const canvas = canvasRef.current;
    const rect = canvas?.getBoundingClientRect();
    const { scale, offsetX, offsetY } = transformRef.current;
    return {
      x: ((event.clientX - (rect?.left ?? 0)) - offsetX) / scale,
      y: ((event.clientY - (rect?.top ?? 0)) - offsetY) / scale,
    };
  };

  const nodeAt = (x: number, y: number): string | null => {
    const layout = layoutRef.current;
    if (!layout) {
      return null;
    }
    let best: string | null = null;
    let bestDist = 14;
    for (const node of layout.nodes.values()) {
      if (hiddenRef.current.has(node.id)) {
        continue;
      }
      const dist = Math.hypot(node.x - x, node.y - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = node.id;
      }
    }
    return best;
  };

  const selectedNode = useMemo(
    () => graph?.nodes.find((node) => node.id === selected) ?? null,
    [graph, selected],
  );

  const related = useMemo(() => {
    if (!graph || !selected) {
      return [];
    }
    const ids = new Set<string>();
    for (const edge of graph.edges) {
      if (edge.from === selected) {
        ids.add(edge.to);
      } else if (edge.to === selected) {
        ids.add(edge.from);
      }
    }
    return graph.nodes
      .filter((node) => ids.has(node.id))
      .sort((a, b) => a.title.localeCompare(b.title, getLocale(), { sensitivity: 'base' }));
  }, [graph, selected]);

  return (
    <div className="graph-view" data-testid="graph-view">
      <canvas
        ref={canvasRef}
        className="graph-canvas"
        onPointerDown={(event) => {
          const world = toWorld(event);
          const hit = nodeAt(world.x, world.y);
          movedRef.current = false;
          if (hit) {
            dragNodeRef.current = hit;
          } else {
            panRef.current = { x: event.clientX, y: event.clientY };
          }
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const world = toWorld(event);
          if (dragNodeRef.current) {
            movedRef.current = true;
            const node = layoutRef.current?.nodes.get(dragNodeRef.current);
            if (node) {
              node.x = world.x;
              node.y = world.y;
              energyRef.current = Math.max(energyRef.current, 60);
            }
          } else if (panRef.current) {
            movedRef.current = true;
            transformRef.current.offsetX += event.clientX - panRef.current.x;
            transformRef.current.offsetY += event.clientY - panRef.current.y;
            panRef.current = { x: event.clientX, y: event.clientY };
          } else {
            hoverRef.current = nodeAt(world.x, world.y);
          }
        }}
        onPointerUp={(event) => {
          const clickedNode = dragNodeRef.current;
          const wasPan = panRef.current !== null;
          dragNodeRef.current = null;
          panRef.current = null;
          if (!movedRef.current) {
            if (clickedNode) {
              if (event.detail >= 2) {
                openFile(`${root}/${clickedNode}`);
              } else {
                select(clickedNode);
              }
            } else if (wasPan) {
              select(null);
            }
          }
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onWheel={(event) => {
          const factor = event.deltaY < 0 ? 1.1 : 0.9;
          const transform = transformRef.current;
          const next = Math.min(3, Math.max(0.3, transform.scale * factor));
          const rect = event.currentTarget.getBoundingClientRect();
          const cx = event.clientX - rect.left;
          const cy = event.clientY - rect.top;
          transform.offsetX = cx - ((cx - transform.offsetX) / transform.scale) * next;
          transform.offsetY = cy - ((cy - transform.offsetY) / transform.scale) * next;
          transform.scale = next;
        }}
      />
      <div className="graph-overlay">
        <span className="graph-stats" data-testid="graph-stats">
          {graph
            ? `${tp('unit.notes', graph.nodes.length - hiddenOrphans.size)} · ${tp('unit.edges', graph.edges.length)}${
                matches !== null ? ` · ${tp('unit.matches', matches.size)}` : ''
              }`
            : t('graph.building')}
        </span>
        <input
          className="graph-search"
          data-testid="graph-search"
          type="search"
          placeholder={t('graph.searchPh')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              submitSearch();
            } else if (event.key === 'Escape') {
              setQuery('');
            }
          }}
        />
        <button
          type="button"
          className={`bar-btn graph-orphans-btn${hideOrphans ? ' graph-orphans-on' : ''}`}
          data-testid="graph-orphans"
          title={t('graph.orphansTitle')}
          onClick={() => setHideOrphans((previous) => !previous)}
        >
          {t('graph.hideOrphans')}
        </button>
        <button type="button" className="bar-btn" data-testid="graph-refresh" onClick={refresh}>
          {t('graph.relayout')}
        </button>
      </div>
      {graph && grouping.groups.length > 0 && (
        <div className="graph-legend" data-testid="graph-legend">
          <div className="graph-mode" role="group" aria-label={t('graph.modeAria')}>
            {MODES.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`graph-mode-btn${mode === entry.id ? ' active' : ''}`}
                data-testid={entry.testId}
                onClick={() => switchMode(entry.id)}
              >
                {t(entry.labelKey)}
              </button>
            ))}
          </div>
          <span className="accent-popover-title">{t(grouping.titleKey)}</span>
          {grouping.groups.map((group) => (
            <button
              key={group.name}
              type="button"
              className={`graph-legend-row${filter === group.name ? ' active' : ''}`}
              data-testid="graph-legend-row"
              title={filter === group.name ? t('graph.filterOff') : t('graph.filterOnly')}
              onClick={() => setFilter(filter === group.name ? null : group.name)}
            >
              {/* color = kolor grupy, bo halo kropki w CSS czerpie z currentColor */}
              <span
                className="graph-legend-dot"
                style={{
                  background: grouping.colors.get(group.name) ?? NEUTRAL_COLOR,
                  color: grouping.colors.get(group.name) ?? NEUTRAL_COLOR,
                }}
              />
              <span className="graph-legend-name">
                {mode === 'fresh'
                  ? t(FRESH_LABEL_KEYS[group.name as FreshnessBucket] ?? 'graph.uncommitted')
                  : group.name === UNCOMMITTED
                    ? t('graph.uncommitted')
                    : group.name === TAGS_FALLBACK
                      ? t('graph.noTags')
                      : group.name}
              </span>
              <span className="graph-legend-count">{group.count}</span>
            </button>
          ))}
        </div>
      )}
      {selectedNode && (
        <div className="graph-details" data-testid="graph-details">
          <div className="graph-details-head">
            <span className="graph-details-title">{selectedNode.title}</span>
            <button
              type="button"
              className="tab-close"
              title={t('graph.closeDetails')}
              onClick={() => select(null)}
            >
              ×
            </button>
          </div>
          <div className="graph-details-meta">
            {selectedNode.id} · {selectedNode.lines} {t('common.linesAbbr')}
            {selectedNode.author && ` · ${selectedNode.author}`}
          </div>
          <div className="graph-details-meta" data-testid="graph-details-tags">
            {tf('graph.tags', { category: selectedNode.category, layer: selectedNode.layer })}
          </div>
          {selectedNode.tags.length > 0 && (
            <div className="graph-details-meta graph-details-hashtags">
              {selectedNode.tags.map((tag) => `#${tag}`).join(' ')}
            </div>
          )}
          <button
            type="button"
            className="bar-btn graph-details-open"
            data-testid="graph-open-note"
            onClick={() => openFile(`${root}/${selectedNode.id}`)}
          >
            {t('graph.openNote')}
          </button>
          <div className="graph-details-related">
            <span className="graph-details-label">
              {related.length > 0
                ? tf('graph.related', { count: related.length })
                : t('graph.noRelated')}
            </span>
            {related.map((node) => (
              <button
                key={node.id}
                type="button"
                className="graph-related-item"
                data-testid="graph-related-item"
                title={node.id}
                onClick={() => select(node.id)}
              >
                <span
                  className="graph-legend-dot"
                  style={{
                    background: grouping.colors.get(grouping.keysOf(node)[0] ?? '') ?? NEUTRAL_COLOR,
                    color: grouping.colors.get(grouping.keysOf(node)[0] ?? '') ?? NEUTRAL_COLOR,
                  }}
                />
                <span className="graph-related-name">{node.title}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <p className="graph-hint placeholder">{t('graph.hint')}</p>
    </div>
  );
}
