import { extractLinkTargets } from './graph';

/**
 * Konspekt wiedzy: automatycznie utrzymywana mapa notatek .md projektu
 * (tytuły, nagłówki, powiązania), żeby Claude jednym plikiem wiedział,
 * co gdzie jest. Czysta logika — testowana jednostkowo.
 */

export interface OutlineSource {
  /** Ścieżka względem korzenia projektu. */
  path: string;
  content: string;
}

export interface OutlineHeading {
  level: number;
  text: string;
}

/** Nagłówki #–### poza blokami kodu. */
export function extractHeadings(content: string): OutlineHeading[] {
  const headings: OutlineHeading[] = [];
  let inFence = false;
  for (const line of content.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) {
      continue;
    }
    const match = /^(#{1,3})\s+(.+?)\s*$/.exec(line);
    if (match?.[1] && match[2]) {
      headings.push({ level: match[1].length, text: match[2] });
    }
  }
  return headings;
}

/**
 * Buduje treść pliku konspektu. Deterministyczna (bez znaczników czasu),
 * żeby zapis następował tylko przy realnej zmianie notatek.
 */
export function buildOutline(projectName: string, sources: OutlineSource[]): string {
  const parts: string[] = [
    `# Konspekt wiedzy — ${projectName}`,
    '',
    'Plik generowany automatycznie przez Sufler na podstawie notatek `.md`',
    'projektu (nie edytuj ręcznie). Dla Claude: to mapa wiedzy — tu sprawdzisz,',
    'w którym pliku znajduje się dany temat.',
  ];
  for (const source of sources) {
    const headings = extractHeadings(source.content).slice(0, 24);
    parts.push('', `## 📄 ${source.path}`);
    for (const heading of headings) {
      parts.push(`${'  '.repeat(heading.level - 1)}- ${heading.text}`);
    }
    const links = [...new Set(extractLinkTargets(source.content))].slice(0, 12);
    if (links.length > 0) {
      parts.push(`- Powiązania: ${links.join(' · ')}`);
    }
  }
  return `${parts.join('\n')}\n`;
}
