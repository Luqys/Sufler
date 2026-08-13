import { useEffect, useState, type ReactElement } from 'react';
import type { StringKey } from '../../../shared/i18n';
import type { McpAddResult } from '../../../shared/ipc';
import {
  mcpNameProblem,
  mcpTargetProblem,
  parseHeaderLines,
  type McpAddInput,
  type McpScope,
  type McpTransport,
} from '../../../shared/mcp-add';
import { tf, useT } from '../i18n';

interface Props {
  onClose(): void;
  /** Zwraca wynik z main; rodzic zamyka dialog przy powodzeniu. */
  onSubmit(input: McpAddInput): Promise<McpAddResult>;
}

const TRANSPORTS: Array<{ id: McpTransport; labelKey: StringKey }> = [
  { id: 'http', labelKey: 'mcp.add.transportHttp' },
  { id: 'sse', labelKey: 'mcp.add.transportSse' },
  { id: 'stdio', labelKey: 'mcp.add.transportStdio' },
];

const NAME_PROBLEM_KEYS: Record<string, StringKey> = {
  empty: 'mcp.add.nameEmpty',
  invalid: 'mcp.add.nameInvalid',
  'too-long': 'mcp.add.nameTooLong',
};

const TARGET_PROBLEM_KEYS: Record<string, StringKey> = {
  'url-empty': 'mcp.add.urlEmpty',
  'url-scheme': 'mcp.add.urlScheme',
  'command-empty': 'mcp.add.commandEmpty',
};

/**
 * Kreator serwera MCP (M79). Zapis idzie przez `claude mcp add`, więc pola
 * odpowiadają temu, co CLI naprawdę przyjmuje: transport, adres albo komenda,
 * zakres i nagłówki.
 */
export function McpCreateDialog({ onClose, onSubmit }: Props): ReactElement {
  const t = useT();
  const [name, setName] = useState('');
  const [transport, setTransport] = useState<McpTransport>('http');
  const [url, setUrl] = useState('');
  const [command, setCommand] = useState('');
  const [headersText, setHeadersText] = useState('');
  const [scope, setScope] = useState<McpScope>('project');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

  const remote = transport !== 'stdio';
  const nameProblem = mcpNameProblem(name);
  const targetProblem = mcpTargetProblem({ transport, url, command });
  const parsedHeaders = parseHeaderLines(headersText);

  const submit = (): void => {
    if (nameProblem) {
      setError(t(NAME_PROBLEM_KEYS[nameProblem] ?? 'mcp.add.nameInvalid'));
      return;
    }
    if (targetProblem) {
      setError(t(TARGET_PROBLEM_KEYS[targetProblem] ?? 'mcp.add.urlEmpty'));
      return;
    }
    if (parsedHeaders.invalid.length > 0) {
      setError(tf('mcp.add.headerInvalid', { line: parsedHeaders.invalid[0] ?? '' }));
      return;
    }
    setError(null);
    setBusy(true);
    void onSubmit({
      name: name.trim(),
      transport,
      url,
      command,
      headers: remote ? parsedHeaders.headers : [],
      scope,
    }).then((result) => {
      setBusy(false);
      if (result.ok) {
        return;
      }
      if (result.error === 'exists') {
        setError(tf('mcp.add.exists', { name: name.trim() }));
      } else if (result.error === 'claude-missing') {
        setError(t('mcp.add.claudeMissing'));
      } else {
        setError(tf('mcp.add.failed', { error: result.cli ?? '' }));
      }
    });
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div
        className="skill-dialog"
        data-testid="mcp-create-dialog"
        role="dialog"
        aria-label={t('mcp.add.title')}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="confirm-title">{t('mcp.add.title')}</h3>
        <p className="skill-dialog-hint">{t('mcp.add.hint')}</p>

        <label className="skill-field">
          {t('mcp.add.name')}
          <input
            type="text"
            data-testid="mcp-create-name"
            value={name}
            placeholder={t('mcp.add.namePh')}
            autoFocus
            spellCheck={false}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
          />
        </label>

        <div className="skill-field">
          {t('mcp.add.transport')}
          <div className="graph-mode mcp-transport" role="group">
            {TRANSPORTS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`graph-mode-btn${transport === entry.id ? ' active' : ''}`}
                data-testid={`mcp-create-transport-${entry.id}`}
                onClick={() => {
                  setTransport(entry.id);
                  setError(null);
                }}
              >
                {t(entry.labelKey)}
              </button>
            ))}
          </div>
        </div>

        {remote ? (
          <label className="skill-field">
            {t('mcp.add.url')}
            <input
              type="text"
              data-testid="mcp-create-url"
              value={url}
              placeholder="https://przyklad.pl/mcp"
              spellCheck={false}
              onChange={(event) => {
                setUrl(event.target.value);
                setError(null);
              }}
            />
          </label>
        ) : (
          <label className="skill-field">
            {t('mcp.add.command')}
            <input
              type="text"
              data-testid="mcp-create-command"
              value={command}
              placeholder="npx -y @scope/serwer-mcp"
              spellCheck={false}
              onChange={(event) => {
                setCommand(event.target.value);
                setError(null);
              }}
            />
          </label>
        )}

        {remote && (
          <label className="skill-field">
            {t('mcp.add.headers')}
            <textarea
              data-testid="mcp-create-headers"
              rows={2}
              value={headersText}
              placeholder={'Authorization: Bearer …'}
              spellCheck={false}
              onChange={(event) => {
                setHeadersText(event.target.value);
                setError(null);
              }}
            />
          </label>
        )}

        <label className="skill-field">
          {t('mcp.add.scope')}
          <select
            data-testid="mcp-create-scope"
            value={scope}
            onChange={(event) => setScope(event.target.value as McpScope)}
          >
            <option value="project">{t('mcp.add.scopeProject')}</option>
            <option value="user">{t('mcp.add.scopeUser')}</option>
            <option value="local">{t('mcp.add.scopeLocal')}</option>
          </select>
        </label>
        <p className="skill-dialog-hint" data-testid="mcp-create-scope-hint">
          {t(
            scope === 'project'
              ? 'mcp.add.scopeProjectHint'
              : scope === 'user'
                ? 'mcp.add.scopeUserHint'
                : 'mcp.add.scopeLocalHint',
          )}
        </p>

        {error && (
          <p className="welcome-error" data-testid="mcp-create-error">
            {error}
          </p>
        )}

        <div className="confirm-actions">
          <button type="button" className="bar-btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="welcome-submit"
            data-testid="mcp-create-submit"
            disabled={busy || nameProblem !== null || targetProblem !== null}
            onClick={submit}
          >
            {t('mcp.add.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
