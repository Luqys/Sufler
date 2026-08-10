import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import {
  mergeMcpServers,
  type McpConfigServer,
  type McpDetail,
  type McpListEntry,
  type McpServerView,
} from '../../../shared/mcp';
import { useWorkspace } from '../workspace';

const STATE_LABEL: Record<McpServerView['state'], string> = {
  connected: 'połączony',
  error: 'błąd połączenia',
  pending: 'oczekuje na zatwierdzenie',
  unknown: 'stan nieznany — odśwież',
};

const ICON_REFRESH = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <path d="M13.4 8a5.4 5.4 0 1 1-1.6-3.8" />
    <path d="M13.6 1.8v2.8h-2.8" />
  </svg>
);

export function McpPanel(): ReactElement {
  const { root } = useWorkspace();
  const [config, setConfig] = useState<McpConfigServer[]>([]);
  const [status, setStatus] = useState<McpListEntry[] | null>(null);
  const [cliError, setCliError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [details, setDetails] = useState<ReadonlyMap<string, McpDetail[] | 'loading'>>(new Map());
  const rootRef = useRef(root);
  rootRef.current = root;
  const subscribed = useRef(false);

  const refresh = useCallback(() => {
    const forRoot = rootRef.current;
    void window.api.readMcpConfig(forRoot).then((servers) => {
      if (rootRef.current === forRoot) {
        setConfig(servers);
      }
    });
    setChecking(true);
    void window.api.listMcpStatus(forRoot).then((result) => {
      if (rootRef.current !== forRoot) {
        return;
      }
      setChecking(false);
      if (result.ok) {
        setStatus(result.entries);
        setCliError(null);
      } else {
        setStatus(null);
        setCliError(result.error);
      }
    });
    setDetails(new Map());
  }, []);

  useEffect(() => {
    refresh();
    void window.api.watchMcp(root);
    if (!subscribed.current) {
      subscribed.current = true;
      window.api.onMcpChanged(refresh);
    }
  }, [refresh, root]);

  const toggleDetails = (name: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
    if (!details.has(name)) {
      setDetails((prev) => new Map(prev).set(name, 'loading'));
      void window.api.getMcpDetails(rootRef.current, name).then((pairs) => {
        setDetails((prev) => new Map(prev).set(name, pairs));
      });
    }
  };

  const servers = mergeMcpServers(config, status);

  return (
    <div className="mcp-panel" data-testid="mcp-panel">
      <div className="mcp-toolbar">
        <span className="mcp-note">
          {checking ? 'Sprawdzanie połączeń…' : 'Konfiguracja + `claude mcp list`'}
        </span>
        <button
          type="button"
          className="tree-toolbtn"
          data-testid="mcp-refresh"
          title="Odśwież (konfiguracja i stan połączeń)"
          onClick={refresh}
        >
          {ICON_REFRESH}
        </button>
      </div>
      {cliError && <p className="mcp-error">CLI: {cliError}</p>}
      {servers.length === 0 && (
        <p className="placeholder">
          Brak zdefiniowanych serwerów MCP. Dodaj przez `claude mcp add …` albo plik `.mcp.json`.
        </p>
      )}
      {servers.map((server) => {
        const isOpen = expanded.has(server.name);
        const serverDetails = details.get(server.name);
        return (
          <div key={server.name} className="mcp-server" data-state={server.state}>
            <button
              type="button"
              className="mcp-row"
              title={`${server.target}\n${STATE_LABEL[server.state]}`}
              onClick={() => toggleDetails(server.name)}
            >
              <span className={`mcp-dot ${server.state}`} />
              <span className="mcp-name">{server.name}</span>
              <span className="mcp-transport">{server.transport}</span>
              {server.scope && <span className="badge">{server.scope}</span>}
              <span className={`mcp-chevron${isOpen ? ' open' : ''}`}>▸</span>
            </button>
            {isOpen && (
              <div className="mcp-details">
                {server.detail && <div className="mcp-detail-line">{server.detail}</div>}
                {serverDetails === 'loading' && (
                  <div className="mcp-detail-line placeholder">Wczytywanie szczegółów…</div>
                )}
                {Array.isArray(serverDetails) && serverDetails.length === 0 && (
                  <div className="mcp-detail-line placeholder">Brak szczegółów z CLI.</div>
                )}
                {Array.isArray(serverDetails) &&
                  serverDetails.map((pair) => (
                    <div key={pair.key} className="mcp-detail-line">
                      <span className="mcp-detail-key">{pair.key}:</span> {pair.value}
                    </div>
                  ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
