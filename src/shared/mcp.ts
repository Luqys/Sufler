export type McpTransport = 'stdio' | 'http' | 'sse';
export type McpScope = 'local' | 'user' | 'project';
export type McpConnectionState = 'connected' | 'error' | 'pending' | 'unknown';

/** Serwer zdefiniowany w plikach konfiguracyjnych. */
export interface McpConfigServer {
  name: string;
  scope: McpScope;
  transport: McpTransport;
  target: string;
}

/** Wiersz z wyjścia `claude mcp list`. */
export interface McpListEntry {
  name: string;
  target: string;
  transport: McpTransport;
  state: Exclude<McpConnectionState, 'unknown'>;
  detail: string;
}

export interface McpDetail {
  key: string;
  value: string;
}

/** Widok panelu: konfiguracja (co zdefiniowane) + CLI (co połączone). */
export interface McpServerView {
  name: string;
  scope: McpScope | null;
  transport: McpTransport;
  target: string;
  state: McpConnectionState;
  detail?: string;
}

/**
 * Łączy oba źródła danych. Kolejność: serwery z konfiguracji (local → project →
 * user, deduplikacja po nazwie zgodnie z precedencją), potem serwery znane
 * tylko CLI (bez scope'u).
 */
export function mergeMcpServers(
  config: McpConfigServer[],
  list: McpListEntry[] | null,
): McpServerView[] {
  const views = new Map<string, McpServerView>();
  for (const server of config) {
    if (!views.has(server.name)) {
      views.set(server.name, { ...server, state: 'unknown' });
    }
  }
  for (const entry of list ?? []) {
    const existing = views.get(entry.name);
    if (existing) {
      existing.state = entry.state;
      existing.detail = entry.detail;
    } else {
      views.set(entry.name, {
        name: entry.name,
        scope: null,
        transport: entry.transport,
        target: entry.target,
        state: entry.state,
        detail: entry.detail,
      });
    }
  }
  return [...views.values()];
}
