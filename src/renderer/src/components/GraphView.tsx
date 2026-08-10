import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { polishPlural, type KnowledgeGraph } from '../../../shared/graph';
import { createLayout, tick, type GraphLayout } from '../../../shared/graph-layout';
import { useWorkspace } from '../workspace';

/** Paleta autorów (stała, niezależna od motywu). */
const AUTHOR_COLORS = [
  '#d97757',
  '#2563eb',
  '#16a34a',
  '#a855f7',
  '#db2777',
  '#0891b2',
  '#f59e0b',
  '#64748b',
];

const UNCOMMITTED = '(niezacommitowane)';

interface ViewTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Graf wiedzy à la Obsidian: notatki .md jako węzły, linki jako krawędzie,
 * kolor = autor ostatniej zmiany (git). Klik otwiera notatkę w edytorze.
 */
export function GraphView(): ReactElement {
  const { root, openFile } = useWorkspace();
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef<GraphLayout | null>(null);
  const transformRef = useRef<ViewTransform>({ scale: 1, offsetX: 0, offsetY: 0 });
  const hoverRef = useRef<string | null>(null);
  const dragNodeRef = useRef<string | null>(null);
  const panRef = useRef<{ x: number; y: number } | null>(null);
  const movedRef = useRef(false);
  const energyRef = useRef(300);
  const authorColorRef = useRef(new Map<string, string>());

  const refresh = useCallback(() => {
    void window.api.getKnowledgeGraph(root).then((data) => {
      const colors = new Map<string, string>();
      data.authors.forEach((author, index) => {
        colors.set(
          author.name,
          author.name === UNCOMMITTED
            ? '#9ca3af'
            : (AUTHOR_COLORS[index % AUTHOR_COLORS.length] ?? '#9ca3af'),
        );
      });
      authorColorRef.current = colors;
      layoutRef.current = null;
      energyRef.current = 320;
      setGraph(data);
    });
  }, [root]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Pętla rysowania + symulacja.
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
        layoutRef.current = createLayout(
          graph.nodes.map((node) => node.id),
          graph.edges,
          width,
          height,
        );
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

      const { scale, offsetX, offsetY } = transformRef.current;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.fillStyle = bgColor;
      context.fillRect(0, 0, width, height);
      context.translate(offsetX, offsetY);
      context.scale(scale, scale);

      const hover = hoverRef.current;
      const hoverNeighbors = hover ? (neighborSets.get(hover) ?? new Set()) : null;

      for (const edge of layout.edges) {
        const a = layout.nodes.get(edge.from);
        const b = layout.nodes.get(edge.to);
        if (!a || !b) {
          continue;
        }
        const active = hover !== null && (edge.from === hover || edge.to === hover);
        context.strokeStyle = mutedColor;
        context.globalAlpha = hover === null ? 0.35 : active ? 0.85 : 0.08;
        context.lineWidth = active ? 1.6 : 1;
        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.stroke();
      }

      for (const node of graph.nodes) {
        const position = layout.nodes.get(node.id);
        if (!position) {
          continue;
        }
        const dimmed =
          hover !== null && node.id !== hover && !(hoverNeighbors?.has(node.id) ?? false);
        const radius = 5 + Math.min(7, degree(node.id) * 1.4);
        context.globalAlpha = dimmed ? 0.18 : 1;
        context.fillStyle =
          authorColorRef.current.get(node.author ?? UNCOMMITTED) ?? '#9ca3af';
        context.beginPath();
        context.arc(position.x, position.y, radius, 0, Math.PI * 2);
        context.fill();
        if (node.id === hover) {
          context.strokeStyle = textColor;
          context.lineWidth = 1.5;
          context.stroke();
        }
        context.fillStyle = dimmed ? mutedColor : textColor;
        context.font = `${node.id === hover ? 600 : 400} 10.5px -apple-system, sans-serif`;
        context.textAlign = 'center';
        context.fillText(node.title, position.x, position.y + radius + 12);
      }
      context.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [graph]);

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
      const dist = Math.hypot(node.x - x, node.y - y);
      if (dist < bestDist) {
        bestDist = dist;
        best = node.id;
      }
    }
    return best;
  };

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
          dragNodeRef.current = null;
          panRef.current = null;
          if (clickedNode && !movedRef.current) {
            openFile(`${root}/${clickedNode}`);
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
            ? `${graph.nodes.length} ${polishPlural(graph.nodes.length, 'notatka', 'notatki', 'notatek')} · ` +
              `${graph.edges.length} ${polishPlural(graph.edges.length, 'połączenie', 'połączenia', 'połączeń')}`
            : 'Buduję graf…'}
        </span>
        <button type="button" className="bar-btn" data-testid="graph-refresh" onClick={refresh}>
          Przelicz
        </button>
      </div>
      {graph && graph.authors.length > 0 && (
        <div className="graph-legend" data-testid="graph-legend">
          <span className="accent-popover-title">Ostatnia zmiana</span>
          {graph.authors.map((author) => (
            <div key={author.name} className="graph-legend-row">
              <span
                className="graph-legend-dot"
                style={{ background: authorColorRef.current.get(author.name) ?? '#9ca3af' }}
              />
              <span className="graph-legend-name">{author.name}</span>
              <span className="graph-legend-count">{author.count}</span>
            </div>
          ))}
        </div>
      )}
      <p className="graph-hint placeholder">
        Klik = otwórz notatkę · przeciągnij węzeł/tło · kółko = zoom
      </p>
    </div>
  );
}
