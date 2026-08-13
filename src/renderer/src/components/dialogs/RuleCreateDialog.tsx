import { useEffect, useState, type ReactElement } from 'react';
import type { RuleCreateInput } from '../../../../shared/ipc';
import { validateSkillName } from '../../../../shared/skills/skills';
import { useT } from '../../i18n';

interface Props {
  onClose(): void;
  /** Zwraca błąd z main albo null przy sukcesie (rodzic zamyka dialog). */
  onSubmit(input: RuleCreateInput): Promise<'invalid-name' | 'exists' | 'write-failed' | null>;
}

/** Kreator reguły: opcjonalne globy `paths` + treść markdown. */
export function RuleCreateDialog({ onClose, onSubmit }: Props): ReactElement {
  const t = useT();
  const [name, setName] = useState('');
  const [paths, setPaths] = useState('');
  const [body, setBody] = useState(() => t('rules.create.template'));
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
            ? 'rules.create.nameEmpty'
            : nameError === 'too-long'
              ? 'skills.create.nameTooLong'
              : 'skills.create.nameInvalid',
        ),
      );
      return;
    }
    setError(null);
    setBusy(true);
    void onSubmit({ name, paths, body }).then((failure) => {
      setBusy(false);
      if (failure === 'exists') {
        setError(t('rules.create.exists'));
      } else if (failure === 'invalid-name') {
        setError(t('skills.create.nameInvalid'));
      } else if (failure === 'write-failed') {
        setError(t('rules.create.failed'));
      }
    });
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div
        className="skill-dialog"
        data-testid="rule-create-dialog"
        role="dialog"
        aria-label={t('rules.create.title')}
        onClick={(event) => event.stopPropagation()}
      >
        <h3 className="confirm-title">{t('rules.create.title')}</h3>
        <p className="skill-dialog-hint">{t('rules.create.hint')}</p>
        <label className="skill-field">
          {t('rules.create.name')}
          <input
            type="text"
            data-testid="rule-create-name"
            value={name}
            placeholder={t('rules.create.namePh')}
            autoFocus
            spellCheck={false}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="skill-field">
          {t('rules.create.paths')}
          <input
            type="text"
            data-testid="rule-create-paths"
            value={paths}
            placeholder={t('rules.create.pathsPh')}
            spellCheck={false}
            onChange={(event) => setPaths(event.target.value)}
          />
        </label>
        <label className="skill-field">
          {t('rules.create.body')}
          <textarea
            data-testid="rule-create-body"
            value={body}
            rows={8}
            spellCheck={false}
            onChange={(event) => setBody(event.target.value)}
          />
        </label>
        {error && (
          <p className="skill-dialog-error" data-testid="rule-create-error">
            {error}
          </p>
        )}
        <div className="confirm-actions">
          <button type="button" className="bar-btn" data-testid="rule-create-cancel" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="confirm-accept"
            data-testid="rule-create-submit"
            disabled={busy}
            onClick={submit}
          >
            {t('rules.create.submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
