/**
 * Slash-komendy (M68): pliki `.md` w `<projekt>/.claude/commands`
 * i `~/.claude/commands`. To czwarty rodzaj pliku z frontmatterem obok
 * skilli, subagentów i reguł — panel czyta je tym samym parserem.
 *
 * Nazwa komendy wynika ze ścieżki względem katalogu `commands`: podkatalogi
 * tworzą przestrzenie nazw rozdzielane dwukropkiem, tak jak w CLI
 * (`commands/frontend/build.md` → `/frontend:build`).
 */

/** Nazwa komendy ze ścieżki względnej; null dla plików spoza `.md`. */
export function commandNameFromRelative(relative: string): string | null {
  const normalized = relative.replace(/\\/g, '/').replace(/^\.\//, '');
  if (!normalized.toLowerCase().endsWith('.md')) {
    return null;
  }
  const segments = normalized
    .slice(0, -3)
    .split('/')
    .filter((segment) => segment !== '');
  if (segments.length === 0) {
    return null;
  }
  return segments.join(':');
}

/** Postać wstawiana do sesji Claude i pokazywana na liście. */
export function commandInvocation(name: string): string {
  return `/${name}`;
}

/**
 * Podpowiedź argumentów z frontmattera obok nazwy — puste pole traktujemy
 * jak brak, żeby nie mnożyć pustych plakietek.
 */
export function commandHint(argumentHint: string | null | undefined): string | null {
  const trimmed = argumentHint?.trim();
  return trimmed ? trimmed : null;
}
