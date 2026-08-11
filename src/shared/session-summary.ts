/**
 * Streszczanie dziennika sesji (M54): zamiast czytać całą listę operacji po
 * `/clear`, wczytujesz kilka zdań na górze pliku. Czysta logika — budowa
 * promptu i wstawianie sekcji do markdownu; wywołanie `claude -p` siedzi
 * w main/session-summary.ts.
 */

/** Nagłówek sekcji ze streszczeniem — rozpoznawany przy aktualizacji. */
export const SUMMARY_HEADING = '## Podsumowanie';

export const SUMMARY_PROMPT = [
  'Streść poniższy dziennik pracy z Claude Code. Odpowiedz wyłącznie treścią',
  'sekcji markdown, bez nagłówka i bez wstępu. Użyj dokładnie dwóch list:',
  '',
  '**Zrobione:** 3–5 punktów w czasie przeszłym, konkretnie (pliki, decyzje).',
  '**Następny krok:** 1–3 punkty — co zostało otwarte albo wymaga sprawdzenia.',
  '',
  'Pisz po polsku, zwięźle, bez lania wody. Dziennik:',
  '',
].join('\n');

/** Tekst do streszczenia: dziennik bez starego podsumowania i frontmattera. */
export function stripForSummary(markdown: string): string {
  const withoutFrontmatter = markdown.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
  return removeSummarySection(withoutFrontmatter).trim();
}

function removeSummarySection(markdown: string): string {
  const start = markdown.indexOf(SUMMARY_HEADING);
  if (start === -1) {
    return markdown;
  }
  const rest = markdown.slice(start + SUMMARY_HEADING.length);
  const nextHeading = rest.search(/\n## /);
  return nextHeading === -1
    ? markdown.slice(0, start)
    : markdown.slice(0, start) + rest.slice(nextHeading + 1);
}

/**
 * Dziennik ze świeżą sekcją podsumowania tuż pod frontmatterem — stare
 * podsumowanie jest zastępowane, a przebieg pracy zostaje nietknięty.
 */
export function withSummary(markdown: string, summary: string, time: string): string {
  const trimmed = summary.trim();
  if (trimmed === '') {
    return markdown;
  }
  const match = /^(---\r?\n[\s\S]*?\r?\n---\r?\n)([\s\S]*)$/.exec(markdown);
  const frontmatter = match?.[1] ?? '';
  const body = removeSummarySection(match?.[2] ?? markdown);
  const section = `${SUMMARY_HEADING}\n\n_Zaktualizowano ${time}._\n\n${trimmed}\n\n`;
  return `${frontmatter}${section}${body.replace(/^\n+/, '')}`;
}

/** Czy dziennik ma dość treści, by streszczenie miało sens. */
export function worthSummarizing(markdown: string): boolean {
  const body = stripForSummary(markdown);
  return body.split('\n').filter((line) => line.trim() !== '').length >= 6;
}
