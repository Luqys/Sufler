import { parse } from 'yaml';

export interface FrontmatterResult {
  data: Record<string, unknown>;
  body: string;
}

/**
 * Wyciąga frontmatter YAML z pliku markdown. Toleruje brak frontmattera
 * i uszkodzony YAML — wtedy `data` jest puste, a `body` to cała treść.
 */
export function parseFrontmatter(content: string): FrontmatterResult {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
  if (!match) {
    return { data: {}, body: content };
  }
  const body = content.slice(match[0].length);
  try {
    const parsed: unknown = parse(match[1] ?? '');
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { data: {}, body };
    }
    return { data: parsed as Record<string, unknown>, body };
  } catch {
    return { data: {}, body };
  }
}

export function frontmatterString(data: Record<string, unknown>, key: string): string | undefined {
  const value = data[key];
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(String).join(', ');
  }
  return undefined;
}

export function frontmatterBool(data: Record<string, unknown>, key: string): boolean {
  const value = data[key];
  return value === true || value === 'true';
}
