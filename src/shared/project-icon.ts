/**
 * „Favicon" projektu na ekranie startowym — ikona wyciągnięta z samego folderu
 * roboczego, żeby pozycje na liście ostatnich były rozpoznawalne na pierwszy
 * rzut oka. Czysta logika: kolejność kandydatów, czytanie `<link rel=icon>`
 * z index.html oraz zapasowy monogram (litery + barwa z hasza ścieżki).
 */

/** Pliki ikon szukane względem korzenia projektu — od najbardziej wiarygodnych. */
export const PROJECT_ICON_FILES: readonly string[] = [
  'favicon.ico',
  'favicon.svg',
  'favicon.png',
  'public/favicon.ico',
  'public/favicon.svg',
  'public/favicon.png',
  'app/favicon.ico',
  'src/app/favicon.ico',
  'src/favicon.ico',
  'static/favicon.ico',
  'static/favicon.svg',
  'static/favicon.png',
  'assets/favicon.ico',
  'assets/favicon.png',
  'public/icon.svg',
  'public/icon.png',
  'public/logo.svg',
  'public/logo.png',
  'build/icon.png',
  'resources/icon.png',
  'assets/icon.png',
  'assets/logo.png',
  'icon.png',
  'icon.svg',
  'logo.png',
  'logo.svg',
];

/** Pliki HTML przeglądane w drugiej kolejności — po `<link rel="icon">`. */
export const PROJECT_ICON_HTML: readonly string[] = [
  'index.html',
  'public/index.html',
  'src/index.html',
  'app/index.html',
  'docs/index.html',
];

const LINK_TAG = /<link\b[^>]*>/gi;

/** Wartość `href` pierwszego `<link rel="…icon…">` w dokumencie; null, gdy brak. */
export function iconHrefFromHtml(html: string): string | null {
  for (const match of html.matchAll(LINK_TAG)) {
    const tag = match[0];
    const rel = /\brel\s*=\s*["']?([^"'>]+)/i.exec(tag)?.[1] ?? '';
    if (!/\bicon\b/i.test(rel)) {
      continue;
    }
    const href = /\bhref\s*=\s*["']([^"']+)["']|\bhref\s*=\s*([^\s"'>]+)/i.exec(tag);
    const value = (href?.[1] ?? href?.[2] ?? '').trim();
    if (value) {
      return value;
    }
  }
  return null;
}

/** Ikona wpisana wprost w HTML jako `data:` — nadaje się od razu do `<img>`. */
export function isInlineIconHref(href: string): boolean {
  return /^data:image\//i.test(href.trim());
}

/**
 * Ścieżki (względem korzenia projektu) do sprawdzenia dla wartości `href`.
 * Adresy zdalne i `data:` odpadają; `/plik.svg` w projektach z Vite/CRA leży
 * fizycznie w `public/` albo `static/`, więc próbujemy obu wariantów.
 */
export function iconHrefPaths(href: string, htmlPath: string): string[] {
  const clean = href.split(/[?#]/)[0]?.trim() ?? '';
  if (!clean || /^[a-z][a-z0-9+.-]*:/i.test(clean) || clean.startsWith('//')) {
    return [];
  }
  if (clean.startsWith('/')) {
    const rel = clean.replace(/^\/+/, '');
    return rel ? [rel, `public/${rel}`, `static/${rel}`] : [];
  }
  const dir = htmlPath.includes('/') ? htmlPath.slice(0, htmlPath.lastIndexOf('/')) : '';
  return [dir ? `${dir}/${clean}` : clean];
}

/**
 * Monogram z nazwy folderu: inicjały dwóch pierwszych członów (myślnik,
 * podkreślenie, spacja albo granica camelCase), a dla jednego słowa dwie
 * pierwsze litery.
 */
export function projectMonogram(name: string): string {
  const words = name
    .replace(/([\p{Ll}\p{N}])(\p{Lu})/gu, '$1 $2')
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  if (words.length === 0) {
    return '?';
  }
  if (words.length === 1) {
    return (words[0] as string).slice(0, 2).toUpperCase();
  }
  return `${(words[0] as string)[0]}${(words[1] as string)[0]}`.toUpperCase();
}

/** Stała barwa (0–359) wyliczona z tekstu — ten sam projekt zawsze ten sam kolor. */
export function projectHue(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % 360;
}
