import { frontmatterString, parseFrontmatter } from '../skills/frontmatter';

/**
 * Kategoryzacja notatek grafu wiedzy: funkcja programu (czego notatka dotyczy)
 * oraz warstwa (frontend/backend). Frontmatter notatki ma pierwszeństwo
 * (`kategoria:`, `warstwa:`), bez niego działa heurystyka słów kluczowych
 * na ścieżce i treści. Czysta logika — testowana jednostkowo.
 */

export interface NoteClassification {
  /** Funkcja programu, np. „Interfejs", „API" — albo własna z frontmattera. */
  category: string;
  /** „Frontend", „Backend", „Frontend + backend" albo „Ogólna". */
  layer: string;
}

export const CATEGORY_FALLBACK = 'Ogólne';
export const LAYER_FRONTEND = 'Frontend';
export const LAYER_BACKEND = 'Backend';
export const LAYER_BOTH = 'Frontend + backend';
export const LAYER_NONE = 'Ogólna';

/**
 * Słowa kluczowe to fragmenty wyrażeń regularnych dopasowywane od początku
 * słowa (lookbehind zamiast \b, bo \b nie działa przed polskimi znakami);
 * brak zakończenia oznacza dowolną odmianę („styl" łapie też „stylu").
 */
function compile(fragments: string[]): RegExp[] {
  return fragments.map(
    (fragment) => new RegExp(`(?<![\\p{L}\\p{N}_])(?:${fragment})`, 'u'),
  );
}

interface CategoryRule {
  name: string;
  patterns: RegExp[];
}

/** Kolejność = priorytet przy remisie liczby trafień. */
const CATEGORY_RULES: CategoryRule[] = [
  {
    name: 'Interfejs',
    patterns: compile([
      'interfejs',
      'widok',
      'ekran',
      'komponent',
      'przycisk',
      'formularz',
      'styl',
      'css\\b',
      'motyw',
      'react',
      'ui\\b',
      'układ',
    ]),
  },
  {
    name: 'API',
    patterns: compile(['api\\b', 'endpoint', 'rest\\b', 'graphql', 'webhook', 'żądani', 'request']),
  },
  {
    name: 'Dane',
    patterns: compile([
      'baz(?:a|ie|y|ą|ę) danych',
      'sql\\b',
      'tabel',
      'migracj',
      'schemat',
      'magazyn',
      'cache\\b',
      'storage',
    ]),
  },
  {
    name: 'Uwierzytelnianie',
    patterns: compile(['auth', 'logowani', 'uwierzytelni', 'autoryzacj', 'hasł', 'uprawni', 'rejestracj']),
  },
  {
    name: 'Testy',
    patterns: compile(['test', 'e2e\\b', 'playwright', 'vitest', 'jednostkow']),
  },
  {
    name: 'Konfiguracja',
    patterns: compile(['konfiguracj', 'config', 'ustawieni', 'instalacj', 'wdrożeni', 'deploy', 'env\\b']),
  },
  {
    name: 'Architektura',
    patterns: compile(['architektur', 'struktur', 'moduł', 'warstw', 'diagram', 'przepływ', 'zależnoś']),
  },
];

const FRONTEND_PATTERNS = compile([
  'frontend',
  'front-end',
  'react',
  'komponent',
  'css\\b',
  'styl',
  'interfejs',
  'widok',
  'ekran',
  'przycisk',
  'formularz',
  'renderer',
  'html',
  'ui\\b',
  'motyw',
  'przeglądark',
]);

const BACKEND_PATTERNS = compile([
  'backend',
  'back-end',
  'serwer',
  'baz(?:a|ie|y|ą|ę) danych',
  'sql\\b',
  'migracj',
  'endpoint',
  'api\\b',
  'ipc\\b',
  'proces',
  'usług',
  'kolejk',
  'demon\\b',
  'cron\\b',
]);

function hits(haystack: string, patterns: RegExp[]): number {
  let count = 0;
  for (const pattern of patterns) {
    if (pattern.test(haystack)) {
      count += 1;
    }
  }
  return count;
}

function heuristicCategory(haystack: string): string {
  let best = CATEGORY_FALLBACK;
  let bestScore = 0;
  for (const rule of CATEGORY_RULES) {
    const score = hits(haystack, rule.patterns);
    if (score > bestScore) {
      best = rule.name;
      bestScore = score;
    }
  }
  return best;
}

function heuristicLayer(haystack: string): string {
  const frontend = hits(haystack, FRONTEND_PATTERNS) > 0;
  const backend = hits(haystack, BACKEND_PATTERNS) > 0;
  if (frontend && backend) {
    return LAYER_BOTH;
  }
  if (frontend) {
    return LAYER_FRONTEND;
  }
  if (backend) {
    return LAYER_BACKEND;
  }
  return LAYER_NONE;
}

/** Wartość `warstwa:` z frontmattera sprowadzona do wspólnych etykiet. */
export function normalizeLayer(value: string): string {
  const raw = value.trim();
  const lower = raw.toLowerCase();
  const front = lower.includes('front');
  const back = lower.includes('back');
  if ((front && back) || /pełny|full|oba|stos/.test(lower)) {
    return LAYER_BOTH;
  }
  if (front) {
    return LAYER_FRONTEND;
  }
  if (back) {
    return LAYER_BACKEND;
  }
  return raw === '' ? LAYER_NONE : raw.charAt(0).toUpperCase() + raw.slice(1);
}

/** Klasyfikuje notatkę: frontmatter wygrywa, heurystyka uzupełnia braki. */
export function classifyNote(path: string, content: string): NoteClassification {
  const { data, body } = parseFrontmatter(content);
  const haystack = `${path}\n${body}`.toLowerCase();
  const fmCategory = frontmatterString(data, 'kategoria')?.trim();
  const fmLayer = frontmatterString(data, 'warstwa')?.trim();
  return {
    category: fmCategory ? fmCategory : heuristicCategory(haystack),
    layer: fmLayer ? normalizeLayer(fmLayer) : heuristicLayer(haystack),
  };
}

/**
 * Wartownik grupy notatek bez tagów — wartość techniczna wspólna dla main
 * i renderera (w legendzie wyświetlana przez i18n `graph.noTags`).
 */
export const TAGS_FALLBACK = '(bez tagów)';

/** Tagi z frontmattera (`tagi:` lub `tags:`; lista YAML albo po przecinkach). */
export function extractTags(content: string): string[] {
  const { data } = parseFrontmatter(content);
  const raw = data['tagi'] ?? data['tags'];
  const values = Array.isArray(raw)
    ? raw.map(String)
    : typeof raw === 'string' || typeof raw === 'number'
      ? String(raw).split(',')
      : [];
  const tags: string[] = [];
  for (const value of values) {
    const tag = value.trim().replace(/^#/, '').toLowerCase();
    if (tag !== '' && !tags.includes(tag)) {
      tags.push(tag);
    }
  }
  return tags;
}
