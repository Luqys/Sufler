import { useEffect, useState, type ReactElement } from 'react';
import type { AgentCreateInput } from '../../../shared/ipc';
import { validateSkillName } from '../../../shared/skills';
import { useT } from '../i18n';

interface Props {
  onClose(): void;
  /** Zwraca błąd z main albo null przy sukcesie (rodzic zamyka dialog). */
  onSubmit(input: AgentCreateInput): Promise<'invalid-name' | 'exists' | 'write-failed' | null>;
}

/** Aliasy modeli z docs sub-agents.md; pusty wybór = inherit (bez pola). */
const AGENT_MODELS = ['sonnet', 'opus', 'haiku', 'fable'] as const;

/** Kreator subagenta: frontmatter + prompt systemowy w jednym formularzu. */
export function AgentCreateDialog({ onClose, onSubmit }: Props): ReactElement {
  const t = useT();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tools, setTools] = useState('');
  const [model, setModel] = useState('');
  const [body, setBody] = useState(() => t('agents.create.template'));
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

  const submit = (): void => {
    const nameError = validateSkillName(name);
    if (nameError !== null) {
      setError(
        t(
          nameError === 'empty'
            ? 'agents.create.nameEmpty'
            : nameError === 'too-long'
              ? 'skills.create.nameTooLong'
              : 'skills.create.nameInvalid',
        ),
      );
      return;
    }
    if (description.trim() === '') {
      setError(t('agents.create.descRequired'));
      return;
    }
    setError(null);
    setBusy(true);
    void onSubmit({ name, description, tools, model, body }).then((failure) => {
      setBusy(false);
      if (failure === 'exists') {
        setError(t('agents.create.exists'));
      } else if (failure === 'invalid-name') {
        setError(t('skills.create.nameInvalid'));
      } else if (failure === 'write-failed') {
        setError(t('agents.create.failed'));
      }
    });
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div
        className="skill-dialog"
        data-testid="agent-create-dialog"
        role="dialog"
        aria-label={t('agents.create.title')}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="confirm-title">{t('agents.create.title')}</h3>
        <p className="skill-dialog-hint">{t('agents.create.hint')}</p>
        <label className="skill-field">
          {t('agents.create.name')}
          <input
            type="text"
            data-testid="agent-create-name"
            value={name}
            placeholder={t('agents.create.namePh')}
            autoFocus
            spellCheck={false}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="skill-field">
          {t('agents.create.description')}
          <input
            type="text"
            data-testid="agent-create-desc"
            value={description}
            placeholder={t('agents.create.descPh')}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label className="skill-field">
          {t('agents.create.tools')}
          <input
            type="text"
            data-testid="agent-create-tools"
            value={tools}
            placeholder={t('agents.create.toolsPh')}
            spellCheck={false}
            onChange={(event) => setTools(event.target.value)}
          />
        </label>
        <label className="skill-field">
          {t('agents.create.model')}
          <select
            data-testid="agent-create-model"
            value={model}
            onChange={(event) => setModel(event.target.value)}
          >
            <option value="">{t('agents.create.modelInherit')}</option>
            {AGENT_MODELS.map((alias) => (
              <option key={alias} value={alias}>
                {alias}
              </option>
            ))}
          </select>
        </label>
        <label className="skill-field">
          {t('agents.create.body')}
          <textarea
            data-testid="agent-create-body"
            value={body}
            rows={8}
            spellCheck={false}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        {error && (
          <p className="skill-dialog-error" data-testid="agent-create-error">
            {error}
          </p>
        )}
        <div className="confirm-actions">
          <button type="button" className="bar-btn" data-testid="agent-create-cancel" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="welcome-open confirm-accept"
            data-testid="agent-create-submit"
            disabled={busy}
            onClick={submit}
          >
            {t('agents.create.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
