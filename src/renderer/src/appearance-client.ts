import type { AccentId } from '../../shared/appearance';

/** Kolor przewodni przez atrybut na <html>; tryb jasny/ciemny załatwia nativeTheme. */
export function applyAccent(accent: AccentId): void {
  document.documentElement.dataset['accent'] = accent;
}
