import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import type { StringKey } from '../../../../shared/i18n';
import {
  mergeMcpServers,
  type McpConfigServer,
  type McpDetail,
  type McpListEntry,
  type McpServerView,
} from '../../../../shared/mcp/mcp';
import { tf, useT } from '../../i18n';
import { useDialogs } from '../../ui-dialogs';
import { useWorkspace } from '../../workspace';
import { McpCreateDialog } from '../dialogs/McpCreateDialog';
import { mcpIconFor } from './mcp-icons';

/** Klucze tłumaczeń stanów — etykietę pobiera t() w momencie renderu. */
const STATE_KEY: Record<McpServerView['state'], StringKey> = {
  connected: 'mcp.stateConnected',
  error: 'mcp.stateError',
  pending: 'mcp.statePending',
  unknown: 'mcp.stateUnknown',
};

const ICON_REFRESH = (
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
    <path d="M13.4 8a5.4 5.4 0 1 1-1.6-3.8" />
    <path d="M13.6 1.8v2.8h-2.8" />
  </svg>
);

export function McpPanel(): ReactElement {
  const t = useT();
  const { root } = useWorkspace();
  const { notify } = useDialogs();
  const [config, setConfig] = useState<McpConfigServer[]>([]);
  const [status, setStatus] = useState<McpListEntry[] | null>(null);
  const [cliError, setCliError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [creating, setCreating] = useState(false);
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
      {/*
        * M104: akcje w jednym pasku z etykietami, źródło danych schodzi pod
        * spód. Wcześniej nad listą stał urwany opis „Konfiguracja + `claude
        * mcp list`" i dwie nagie ikony dosunięte do prawej — z tego rzędu nie
        * dało się wyczytać, że cokolwiek jest do kliknięcia.
        */}
      <div className="mcp-toolbar segmented" role="group">
        <button
          type="button"
          className="segmented-btn"
          data-testid="mcp-add"
          title={t('mcp.add.title')}
          onClick={() => setCreating(true)}
        >
          {t('mcp.addShort')}
        </button>
        <button
          type="button"
          className="segmented-btn mcp-refresh-btn"
          data-testid="mcp-refresh"
          title={t('mcp.refresh')}
          onClick={refresh}
        >
          {ICON_REFRESH}
          {t('mcp.refreshShort')}
        </button>
      </div>
      <p className="mcp-note">{checking ? t('mcp.checking') : t('mcp.source')}</p>
      {creating && (
        <McpCreateDialog
          onClose={() => setCreating(false)}
          onSubmit={async (input) => {
            const result = await window.api.addMcpServer(rootRef.current, input);
            if (result.ok) {
              setCreating(false);
              notify(tf('mcp.add.added', { name: input.name }), 'success');
              refresh();
            }
            return result;
          }}
        />
      )}
      {cliError && <p className="mcp-error">{tf('mcp.cliError', { error: cliError })}</p>}
      {servers.length === 0 && <p className="placeholder">{t('mcp.empty')}</p>}
      {servers.map((server) => {
        const isOpen = expanded.has(server.name);
        const serverDetails = details.get(server.name);
        return (
          <div key={server.name} className="mcp-server" data-state={server.state}>
            <button
              type="button"
              className="mcp-row"
              title={`${server.target}\n${t(STATE_KEY[server.state])}`}
              onClick={() => toggleDetails(server.name)}
            >
              <span className={`mcp-dot ${server.state}`} />
              <span className="mcp-icon">{mcpIconFor(server.name)}</span>
              {/*
                * Nazwa w pierwszym wierszu, transport i zakres w drugim (M104):
                * w jednym rzędzie nazwa dostawała resztki po plakietkach
                * i zostawało z niej „s…". Ten sam układ co wiersz commita.
                */}
              <span className="mcp-row-main">
                <span className="mcp-name">{server.name}</span>
                <span className="mcp-row-meta">
                  <span className="mcp-transport">{server.transport}</span>
                  {server.scope && <span className="badge">{server.scope}</span>}
                </span>
              </span>
              <span className={`mcp-chevron${isOpen ? ' open' : ''}`}>▸</span>
            </button>
            {server.name.toLowerCase() === 'obsidian' && server.state === 'error' && (
              <div className="mcp-hint" data-testid="obsidian-hint">
                {t('mcp.obsidianHint')}
              </div>
            )}
            {isOpen && (
              /*
               * Szczegóły jako karta z parami klucz–wartość w dwóch kolumnach:
               * wcześniej leciały jednym ciągiem „klucz: wartość" i przy dłuższym
               * adresie zlewały się w akapit, w którym nie było widać, gdzie
               * kończy się jedna wartość, a zaczyna następna.
               */
              <dl className="mcp-details" data-testid="mcp-details">
                <div className="mcp-detail-row">
                  <dt>{t('mcp.detailState')}</dt>
                  <dd>
                    <span className={`mcp-dot ${server.state}`} />
                    {t(STATE_KEY[server.state])}
                    {server.detail && <span className="mcp-detail-note">{server.detail}</span>}
                  </dd>
                </div>
                {/*
                  * Adres i transport pokazujemy z własnej konfiguracji tylko
                  * wtedy, gdy CLI nic nie podało — inaczej karta powtarzałaby
                  * to samo dwa razy (Command/Args/Type z `claude mcp get`).
                  */}
                {!(Array.isArray(serverDetails) && serverDetails.length > 0) && (
                  <>
                    <div className="mcp-detail-row">
                      <dt>{t('mcp.detailTarget')}</dt>
                      <dd className="mcp-detail-mono">{server.target}</dd>
                    </div>
                    <div className="mcp-detail-row">
                      <dt>{t('mcp.detailTransport')}</dt>
                      <dd>
                        {server.transport}
                        {server.scope && <span className="badge">{server.scope}</span>}
                      </dd>
                    </div>
                  </>
                )}
                {serverDetails === 'loading' && (
                  <div className="mcp-detail-row">
                    <dd className="placeholder">{t('mcp.loadingDetails')}</dd>
                  </div>
                )}
                {Array.isArray(serverDetails) && serverDetails.length === 0 && (
                  <div className="mcp-detail-row">
                    <dd className="placeholder">{t('mcp.noDetails')}</dd>
                  </div>
                )}
                {Array.isArray(serverDetails) &&
                  serverDetails.map((pair) => (
                    <div key={pair.key} className="mcp-detail-row">
                      <dt>{pair.key}</dt>
                      <dd className="mcp-detail-mono">{pair.value}</dd>
                    </div>
                  ))}
              </dl>
            )}
          </div>
        );
      })}
    </div>
  );
}
