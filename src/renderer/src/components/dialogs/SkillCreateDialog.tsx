import { useEffect, useState, type ReactElement } from 'react';
import type { SkillCreateInput, SkillScope } from '../../../../shared/ipc';
import { validateSkillName } from '../../../../shared/skills/skills';
import { useT } from '../../i18n';

interface Props {
  onClose(): void;
  /** Zwraca błąd z main albo null przy sukcesie (rodzic zamyka dialog). */
  onSubmit(input: SkillCreateInput): Promise<'invalid-name' | 'exists' | 'write-failed' | null>;
}

/** Kreator nowego skilla: frontmatter + instrukcje w jednym formularzu. */
export function SkillCreateDialog({ onClose, onSubmit }: Props): ReactElement {
  const t = useT();
  const [scope, setScope] = useState<SkillScope>('project');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [manual, setManual] = useState(false);
  const [disallowedTools, setDisallowedTools] = useState('');
  const [body, setBody] = useState(() => t('skills.create.template'));
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
            ? 'skills.create.nameEmpty'
            : nameError === 'too-long'
              ? 'skills.create.nameTooLong'
              : 'skills.create.nameInvalid',
        ),
      );
      return;
    }
    if (description.trim() === '') {
      setError(t('skills.create.descRequired'));
      return;
    }
    setError(null);
    setBusy(true);
    void onSubmit({ scope, name, description, manual, disallowedTools, body }).then((failure) => {
      setBusy(false);
      if (failure === 'exists') {
        setError(t('skills.create.exists'));
      } else if (failure === 'invalid-name') {
        setError(t('skills.create.nameInvalid'));
      } else if (failure === 'write-failed') {
        setError(t('skills.create.failed'));
      }
    });
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div
        className="skill-dialog"
        data-testid="skill-create-dialog"
        role="dialog"
        aria-label={t('skills.create.title')}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="confirm-title">{t('skills.create.title')}</h3>
        <p className="skill-dialog-hint">{t('skills.create.hint')}</p>
        <label className="skill-field">
          {t('skills.create.scope')}
          <select
            data-testid="skill-create-scope"
            value={scope}
            onChange={(event) => setScope(event.target.value as SkillScope)}
          >
            <option value="project">{t('skills.create.scopeProject')}</option>
            <option value="personal">{t('skills.create.scopePersonal')}</option>
          </select>
        </label>
        <label className="skill-field">
          {t('skills.create.name')}
          <input
            type="text"
            data-testid="skill-create-name"
            value={name}
            placeholder={t('skills.create.namePh')}
            autoFocus
            spellCheck={false}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="skill-field">
          {t('skills.create.description')}
          <input
            type="text"
            data-testid="skill-create-desc"
            value={description}
            placeholder={t('skills.create.descPh')}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label className="skill-check">
          <input
            type="checkbox"
            data-testid="skill-create-manual"
            checked={manual}
            onChange={(event) => setManual(event.target.checked)}
          />
          {t('skills.create.manual')}
        </label>
        <label className="skill-field">
          {t('skills.create.disallowed')}
          <input
            type="text"
            data-testid="skill-create-disallowed"
            value={disallowedTools}
            placeholder={t('skills.create.disallowedPh')}
            spellCheck={false}
            onChange={(event) => setDisallowedTools(event.target.value)}
          />
        </label>
        <label className="skill-field">
          {t('skills.create.body')}
          <textarea
            data-testid="skill-create-body"
            value={body}
            rows={8}
            spellCheck={false}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        {error && (
          <p className="skill-dialog-error" data-testid="skill-create-error">
            {error}
          </p>
        )}
        <div className="confirm-actions">
          <button type="button" className="bar-btn" data-testid="skill-create-cancel" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="confirm-accept"
            data-testid="skill-create-submit"
            disabled={busy}
            onClick={submit}
          >
            {t('skills.create.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
