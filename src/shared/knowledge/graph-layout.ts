import type { GraphEdge } from './graph';

/**
 * Prosty układ siłowy (sprężyny + odpychanie + grawitacja do środka) —
 * wystarczający dla grafów notatek (≤ setki węzłów). Deterministyczny
 * przy tym samym wejściu (pozycje startowe na okręgu).
 */

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface GraphLayout {
  nodes: Map<string, LayoutNode>;
  edges: GraphEdge[];
  width: number;
  height: number;
}

export function createLayout(
  ids: string[],
  edges: GraphEdge[],
  width: number,
  height: number,
): GraphLayout {
  const nodes = new Map<string, LayoutNode>();
  const radius = Math.min(width, height) * 0.32;
  ids.forEach((id, index) => {
    const angle = (index / Math.max(1, ids.length)) * Math.PI * 2;
    // Lekka spirala rozbija idealną symetrię (stabilniejsza zbieżność).
    const r = radius * (0.6 + 0.4 * ((index % 7) / 7));
    nodes.set(id, {
      id,
      x: width / 2 + Math.cos(angle) * r,
      y: height / 2 + Math.sin(angle) * r,
      vx: 0,
      vy: 0,
    });
  });
  return { nodes, edges, width, height };
}

const REPULSION = 5200;
const SPRING = 0.045;
const SPRING_LENGTH = 80;
const GRAVITY = 0.015;
const DAMPING = 0.85;

/** Jeden krok symulacji; `pinned` (np. węzeł ciągnięty myszą) nie drga. */
export function tick(layout: GraphLayout, pinned?: string): void {
  const nodes = [...layout.nodes.values()];
  for (const node of nodes) {
    let fx = 0;
    let fy = 0;
    for (const other of nodes) {
      if (other === node) {
        continue;
      }
      const dx = node.x - other.x;
      const dy = node.y - other.y;
      const distSq = Math.max(64, dx * dx + dy * dy);
      const force = REPULSION / distSq;
      const dist = Math.sqrt(distSq);
      fx += (dx / dist) * force;
      fy += (dy / dist) * force;
    }
    fx += (layout.width / 2 - node.x) * GRAVITY;
    fy += (layout.height / 2 - node.y) * GRAVITY;
    node.vx = (node.vx + fx) * DAMPING;
    node.vy = (node.vy + fy) * DAMPING;
  }
  for (const edge of layout.edges) {
    const a = layout.nodes.get(edge.from);
    const b = layout.nodes.get(edge.to);
    if (!a || !b) {
      continue;
    }
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const force = (dist - SPRING_LENGTH) * SPRING;
    const ux = dx / dist;
    const uy = dy / dist;
    a.vx += ux * force;
    a.vy += uy * force;
    b.vx -= ux * force;
    b.vy -= uy * force;
  }
  for (const node of nodes) {
    if (node.id === pinned) {
      node.vx = 0;
      node.vy = 0;
      continue;
    }
    node.x += node.vx;
    node.y += node.vy;
  }
}
