import { describe, expect, it } from 'vitest';
import {
  stripForSummary,
  SUMMARY_HEADING,
  withSummary,
  worthSummarizing,
} from '../../src/shared/claude/session-summary';

const LOG = `---
kategoria: Dziennik sesji
---

# Dziennik sesji — projekt

## 10:00 — polecenie

Napraw limity

- \`10:01\` edycja: \`src/limits.ts\`
- \`10:02\` powłoka: \`npm test\`
- \`10:03\` edycja: \`src/ui.tsx\`
`;

describe('withSummary', () => {
  it('wstawia sekcję tuż pod frontmatterem, zostawiając przebieg pracy', () => {
    const next = withSummary(LOG, '**Zrobione:**\n- limity', '2026-08-11 01:00');
    const afterFrontmatter = next.split('---\n')[2] ?? '';
    expect(afterFrontmatter.trimStart().startsWith(SUMMARY_HEADING)).toBe(true);
    expect(next).toContain('Zaktualizowano 2026-08-11 01:00');
    expect(next).toContain('## 10:00 — polecenie');
    expect(next).toContain('edycja: `src/ui.tsx`');
  });

  it('ponowne streszczenie zastępuje poprzednie, nie mnoży sekcji', () => {
    const once = withSummary(LOG, 'pierwsze', '01:00');
    const twice = withSummary(once, 'drugie', '02:00');
    expect(twice.match(new RegExp(SUMMARY_HEADING, 'g'))).toHaveLength(1);
    expect(twice).toContain('drugie');
    expect(twice).not.toContain('pierwsze');
    expect(twice).toContain('## 10:00 — polecenie');
  });

  it('puste streszczenie nie rusza pliku', () => {
    expect(withSummary(LOG, '   ', '01:00')).toBe(LOG);
  });
});

describe('stripForSummary', () => {
  it('usuwa frontmatter i poprzednie podsumowanie', () => {
    const withOld = withSummary(LOG, 'stare podsumowanie', '01:00');
    const stripped = stripForSummary(withOld);
    expect(stripped).not.toContain('kategoria:');
    expect(stripped).not.toContain('stare podsumowanie');
    expect(stripped).toContain('Napraw limity');
  });
});

describe('worthSummarizing', () => {
  it('świeży dziennik z jednym wpisem nie idzie do Claude', () => {
    expect(worthSummarizing('---\na: b\n---\n\n# Tytuł\n\n## 10:00 — polecenie\n\nCoś\n')).toBe(false);
  });

  it('dziennik z kilkoma operacjami tak', () => {
    expect(worthSummarizing(LOG)).toBe(true);
  });
});
