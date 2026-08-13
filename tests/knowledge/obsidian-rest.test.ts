import { describe, expect, it } from 'vitest';
import {
  buildAppendRequest,
  formatLocalDate,
  resolveDailyPath,
} from '../../src/shared/knowledge/obsidian-rest';

const DATA = new Date(2026, 7, 10); // 10 sierpnia 2026 (miesiące 0-bazowe)

describe('resolveDailyPath', () => {
  it('podstawia {date} w formacie YYYY-MM-DD', () => {
    expect(formatLocalDate(DATA)).toBe('2026-08-10');
    expect(resolveDailyPath('Dziennik/{date}.md', DATA)).toBe('Dziennik/2026-08-10.md');
    expect(resolveDailyPath('Stała.md', DATA)).toBe('Stała.md');
  });
});

describe('buildAppendRequest', () => {
  const config = {
    url: 'http://127.0.0.1:41999/',
    apiKey: 'sekret',
    dailyFile: 'Dziennik/{date}.md',
    dailyHeading: 'Wycinki',
  };

  it('buduje PATCH-owe nagłówki pluginu Local REST API', () => {
    const request = buildAppendRequest(config, 'treść', DATA);
    expect(request?.url).toBe('http://127.0.0.1:41999/vault/Dziennik/2026-08-10.md');
    expect(request?.headers).toEqual({
      Authorization: 'Bearer sekret',
      'Content-Type': 'text/markdown',
      Operation: 'append',
      'Target-Type': 'heading',
      Target: 'Wycinki',
    });
    expect(request?.body).toBe('treść\n');
  });

  it('koduje segmenty ścieżki (spacje, polskie znaki), URL domyślny po pustym', () => {
    const request = buildAppendRequest(
      { ...config, url: '  ', dailyFile: 'Moje notatki/Dzień {date}.md' },
      'x\n',
      DATA,
    );
    expect(request?.url).toBe(
      'http://127.0.0.1:27123/vault/Moje%20notatki/Dzie%C5%84%202026-08-10.md',
    );
    expect(request?.body).toBe('x\n');
  });

  it('zwraca null przy niekompletnej konfiguracji', () => {
    expect(buildAppendRequest({ ...config, apiKey: '' }, 'x', DATA)).toBeNull();
    expect(buildAppendRequest({ ...config, dailyFile: '  ' }, 'x', DATA)).toBeNull();
    expect(buildAppendRequest({ ...config, dailyHeading: undefined }, 'x', DATA)).toBeNull();
  });
});
