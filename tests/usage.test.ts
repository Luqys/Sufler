import { describe, expect, it } from 'vitest';
import { formatTokens } from '../src/shared/usage';

describe('formatTokens', () => {
  it('formatuje z polskim przecinkiem i skrótami', () => {
    expect(formatTokens(999)).toBe('999');
    expect(formatTokens(1234)).toBe('1,2 tys.');
    expect(formatTokens(21349)).toBe('21,3 tys.');
    expect(formatTokens(5_600_000)).toBe('5,6 mln');
  });
});
