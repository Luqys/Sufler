import { stringify } from 'yaml';

/**
 * Reguły projektu: pliki `.claude/rules/<nazwa>.md` doklejane do kontekstu
 * sesji Claude Code. Frontmatter `paths` (lista globów YAML — docs:
 * memory.md#organize-rules-with-claude/rules/) ogranicza regułę do plików
 * pasujących do wzorców; bez niego reguła ładuje się zawsze, jak CLAUDE.md.
 */

export interface RuleDraft {
  name: string;
  /** Globy po przecinku z formularza; puste = reguła bez ograniczeń. */
  paths?: string;
  body: string;
}

/** Globy z pola formularza — przecinki i nadmiarowe spacje do listy. */
export function parseRulePaths(paths: string | undefined): string[] {
  return (paths ?? '')
    .split(',')
    .map((glob) => glob.trim())
    .filter((glob) => glob !== '');
}

/** Treść nowego pliku reguły; bez globów plik nie dostaje frontmattera. */
export function buildRuleFile(draft: RuleDraft): string {
  const globs = parseRulePaths(draft.paths);
  const body = draft.body.trim();
  const bodyBlock = body === '' ? '' : `${body}\n`;
  if (globs.length === 0) {
    return bodyBlock;
  }
  return `---\n${stringify({ paths: globs })}---\n${bodyBlock === '' ? '' : `\n${bodyBlock}`}`;
}
