import { readFile, stat } from 'node:fs/promises';
import { join, resolve, sep } from 'node:path';
import { imageMime } from '../../shared/editor/media';
import {
  iconHrefFromHtml,
  iconHrefPaths,
  isInlineIconHref,
  PROJECT_ICON_FILES,
  PROJECT_ICON_HTML,
} from '../../shared/project/project-icon';

/** Ikony bywają duże (wielorozmiarowe .ico), ale nie aż tak. */
const MAX_ICON_SIZE = 512 * 1024;
const MAX_HTML_SIZE = 1024 * 1024;

/** Wynik per korzeń trzymany do końca życia procesu — ekran startowy pyta raz. */
const cache = new Map<string, string | null>();

function insideRoot(root: string, path: string): boolean {
  const base = resolve(root);
  const target = resolve(path);
  return target === base || target.startsWith(base.endsWith(sep) ? base : `${base}${sep}`);
}

async function readIconFile(root: string, relative: string): Promise<string | null> {
  const path = join(root, relative);
  if (!insideRoot(root, path)) {
    return null;
  }
  const mime = imageMime(path);
  if (!mime) {
    return null;
  }
  try {
    const info = await stat(path);
    if (!info.isFile() || info.size === 0 || info.size > MAX_ICON_SIZE) {
      return null;
    }
    const buffer = await readFile(path);
    return `data:${mime};base64,${buffer.toString('base64')}`;
  } catch {
    return null;
  }
}

/** Drugie podejście: `<link rel="icon">` z index.html projektu. */
async function readIconFromHtml(root: string): Promise<string | null> {
  for (const htmlPath of PROJECT_ICON_HTML) {
    let html: string;
    try {
      const info = await stat(join(root, htmlPath));
      if (!info.isFile() || info.size > MAX_HTML_SIZE) {
        continue;
      }
      html = await readFile(join(root, htmlPath), 'utf8');
    } catch {
      continue;
    }
    const href = iconHrefFromHtml(html);
    if (!href) {
      continue;
    }
    if (isInlineIconHref(href)) {
      return href.trim();
    }
    for (const candidate of iconHrefPaths(href, htmlPath)) {
      const dataUri = await readIconFile(root, candidate);
      if (dataUri) {
        return dataUri;
      }
    }
  }
  return null;
}

/**
 * Ikona projektu jako `data:` URI — najpierw typowe pliki faviconu, potem
 * deklaracja z index.html. Null, gdy projekt żadnej ikony nie ma (renderer
 * rysuje wtedy monogram).
 */
export async function readProjectIcon(root: string): Promise<string | null> {
  const cached = cache.get(root);
  if (cached !== undefined) {
    return cached;
  }
  let found: string | null = null;
  for (const relative of PROJECT_ICON_FILES) {
    found = await readIconFile(root, relative);
    if (found) {
      break;
    }
  }
  const result = found ?? (await readIconFromHtml(root));
  cache.set(root, result);
  return result;
}
