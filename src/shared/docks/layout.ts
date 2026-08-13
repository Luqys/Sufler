export interface LayoutState {
  version: 1;
  sidebarWidth: number;
  rightDockWidth: number;
  bottomDockHeight: number;
  sidebarVisible: boolean;
  rightDockVisible: boolean;
  bottomDockVisible: boolean;
}

export type LayoutVisibilityKey = 'sidebarVisible' | 'rightDockVisible' | 'bottomDockVisible';

export type LayoutSizeKey = 'sidebarWidth' | 'rightDockWidth' | 'bottomDockHeight';

interface SizeLimit {
  min: number;
  max: number;
  default: number;
}

export const LAYOUT_LIMITS: Record<LayoutSizeKey, SizeLimit> = {
  sidebarWidth: { min: 180, max: 520, default: 240 },
  rightDockWidth: { min: 240, max: 900, default: 360 },
  bottomDockHeight: { min: 120, max: 700, default: 220 },
};

export function defaultLayout(): LayoutState {
  return {
    version: 1,
    sidebarWidth: LAYOUT_LIMITS.sidebarWidth.default,
    rightDockWidth: LAYOUT_LIMITS.rightDockWidth.default,
    bottomDockHeight: LAYOUT_LIMITS.bottomDockHeight.default,
    sidebarVisible: true,
    rightDockVisible: true,
    bottomDockVisible: true,
  };
}

export function clampSize(key: LayoutSizeKey, value: number): number {
  const { min, max } = LAYOUT_LIMITS[key];
  return Math.min(max, Math.max(min, Math.round(value)));
}

function readSize(raw: Record<string, unknown>, key: LayoutSizeKey): number {
  const value = raw[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return LAYOUT_LIMITS[key].default;
  }
  return clampSize(key, value);
}

/**
 * Toleruje dowolne dane wejściowe (uszkodzony plik, stary format, ręczna edycja)
 * i zawsze zwraca poprawny stan układu.
 */
function readFlag(raw: Record<string, unknown>, key: LayoutVisibilityKey): boolean {
  const value = raw[key];
  return typeof value === 'boolean' ? value : true;
}

export function normalizeLayout(raw: unknown): LayoutState {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return defaultLayout();
  }
  const obj = raw as Record<string, unknown>;
  return {
    version: 1,
    sidebarWidth: readSize(obj, 'sidebarWidth'),
    rightDockWidth: readSize(obj, 'rightDockWidth'),
    bottomDockHeight: readSize(obj, 'bottomDockHeight'),
    sidebarVisible: readFlag(obj, 'sidebarVisible'),
    rightDockVisible: readFlag(obj, 'rightDockVisible'),
    bottomDockVisible: readFlag(obj, 'bottomDockVisible'),
  };
}
