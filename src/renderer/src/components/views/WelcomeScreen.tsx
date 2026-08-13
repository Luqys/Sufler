import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import logoUrl from '../../assets/logo.png';
import type { StringKey } from '../../../../shared/i18n';
import { baseName } from '../../../../shared/editor/paths';
import { projectHue, projectMonogram } from '../../../../shared/project/project-icon';
import {
  projectNameProblem,
  projectTargetPath,
  type ProjectNameProblem,
} from '../../../../shared/project/project-create';
import { tf, useT } from '../../i18n';

interface WelcomeScreenProps {
  onPicked(root: string): void;
}

const ICON_OPEN = (
  <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1.8 4.2a1 1 0 0 1 1-1h3.1l1.4 1.6h5.9a1 1 0 0 1 1 1v6.1a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1V4.2Z" />
  </svg>
);

/** Folder z plusem — nowy, pusty katalog roboczy. */
const ICON_NEW = (
  <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1.8 4.2a1 1 0 0 1 1-1h3.1l1.4 1.6h5.9a1 1 0 0 1 1 1v6.1a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1V4.2Z" />
    <path d="M8 7.3v4M6 9.3h4" />
  </svg>
);

/**
 * Znak na ekranie startowym to IKONA APLIKACJI (M77) — ta sama, którą widać
 * w Docku i w Finderze. Wcześniej stał tu osobny rysunek dymka, więc start
 * wyglądał jak inny program niż ten w pasku.
 */

/**
 * Ekran startowy: przy każdym uruchomieniu użytkownik wybiera folder roboczy.
 * Terminale i sesje Claude będą startować właśnie w nim.
 */
/**
 * Kafelek projektu: favicon wzięty z folderu, a gdy projekt żadnego nie ma —
 * monogram na barwie wyliczonej ze ścieżki (ten sam projekt, ten sam kolor).
 */
function ProjectMark({ path, icon }: { path: string; icon: string | null }): ReactElement {
  if (icon) {
    return (
      <span className="welcome-recent-icon" data-mark="favicon">
        <img src={icon} alt="" className="welcome-recent-favicon" data-testid="welcome-favicon" />
      </span>
    );
  }
  return (
    <span
      className="welcome-recent-icon"
      data-mark="monogram"
      data-testid="welcome-monogram"
      style={{ '--project-hue': String(projectHue(path)) } as CSSProperties}
    >
      {projectMonogram(baseName(path))}
    </span>
  );
}

const PROBLEM_KEYS: Record<ProjectNameProblem, StringKey> = {
  empty: 'welcome.newErrorEmpty',
  separator: 'welcome.newErrorSeparator',
  dot: 'welcome.newErrorDot',
  invalid: 'welcome.newErrorInvalid',
  'too-long': 'welcome.newErrorTooLong',
};

const CREATE_ERROR_KEYS: Record<string, StringKey> = {
  'invalid-name': 'welcome.newErrorInvalid',
  exists: 'welcome.newErrorExists',
  'no-parent': 'welcome.newErrorNoParent',
  'mkdir-failed': 'welcome.newErrorFailed',
};

export function WelcomeScreen({ onPicked }: WelcomeScreenProps): ReactElement {
  const t = useT();
  const [recents, setRecents] = useState<string[]>([]);
  const [icons, setIcons] = useState<Record<string, string | null>>({});
  /** Formularz nowego projektu rozwija się w miejscu — bez skoku do dialogu. */
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [parent, setParent] = useState('');
  const [initGit, setInitGit] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void window.api.getRecentRoots().then((list) => {
      setRecents(list);
      for (const path of list) {
        void window.api.getProjectIcon(path).then((icon) => {
          setIcons((current) => ({ ...current, [path]: icon }));
        });
      }
    });
  }, []);

  const browse = (): void => {
    void window.api.openProjectDialog().then((picked) => {
      if (picked) {
        onPicked(picked);
      }
    });
  };

  const pickRecent = (path: string): void => {
    void window.api.setProjectRoot(path).then((ok) => {
      if (ok) {
        onPicked(path);
      } else {
        setRecents((current) => current.filter((entry) => entry !== path));
      }
    });
  };

  const startCreating = (): void => {
    setError(null);
    setCreating(true);
    // Lokalizacja domyślna: katalog obok ostatnio otwartego projektu.
    void window.api.getDefaultProjectParent().then((suggested) => {
      setParent((current) => (current === '' ? suggested : current));
    });
  };

  const changeParent = (): void => {
    void window.api.chooseProjectParent().then((picked) => {
      if (picked) {
        setParent(picked);
        setError(null);
      }
    });
  };

  const problem = projectNameProblem(name);
  const target = projectTargetPath(parent, name);

  const submit = (): void => {
    if (problem !== null) {
      setError(t(PROBLEM_KEYS[problem]));
      return;
    }
    setBusy(true);
    void window.api.createProject({ parent, name: name.trim(), initGit }).then((result) => {
      setBusy(false);
      if (!result.ok) {
        setError(t(CREATE_ERROR_KEYS[result.error] ?? 'welcome.newErrorFailed'));
        return;
      }
      onPicked(result.path);
    });
  };

  return (
    <div className="shell">
      <header className="titlebar">Sufler</header>
      <div className="welcome" data-testid="welcome">
        <div className="welcome-card">
          <div className="welcome-hero">
            <span className="welcome-mark-halo" aria-hidden>
              <span className="welcome-mark">
                <img src={logoUrl} alt="" className="welcome-mark-logo" data-testid="welcome-logo" />
              </span>
            </span>
            <div className="welcome-logo">Sufler</div>
            <span className="welcome-tagline">
              <span className="welcome-tagline-spark" aria-hidden>
                ✳
              </span>
              {t('welcome.tagline')}
            </span>
            <p className="welcome-sub">{t('welcome.sub')}</p>
          </div>
          {/* Dwie równorzędne drogi na start: nowy folder albo istniejący. */}
          <div className="welcome-actions">
            <button
              type="button"
              className={`welcome-action${creating ? ' active' : ''}`}
              data-testid="welcome-new"
              onClick={startCreating}
            >
              <span className="welcome-action-icon">{ICON_NEW}</span>
              <span className="welcome-action-text">
                <span className="welcome-action-label">{t('welcome.new')}</span>
                <span className="welcome-action-hint">{t('welcome.newHint')}</span>
              </span>
            </button>
            <button
              type="button"
              className="welcome-action"
              data-testid="welcome-open"
              onClick={browse}
            >
              <span className="welcome-action-icon">{ICON_OPEN}</span>
              <span className="welcome-action-text">
                <span className="welcome-action-label">{t('welcome.open')}</span>
                <span className="welcome-action-hint">{t('welcome.openHint')}</span>
              </span>
            </button>
          </div>

          {creating && (
            <form
              className="welcome-new-form"
              data-testid="welcome-new-form"
              onSubmit={(event) => {
                event.preventDefault();
                submit();
              }}
            >
              <label className="welcome-field">
                <span className="welcome-field-label">{t('welcome.newName')}</span>
                <input
                  type="text"
                  className="welcome-input"
                  data-testid="welcome-new-name"
                  value={name}
                  placeholder={t('welcome.newNamePlaceholder')}
                  spellCheck={false}
                  autoFocus
                  onChange={(event) => {
                    setName(event.target.value);
                    setError(null);
                  }}
                />
              </label>
              <label className="welcome-field">
                <span className="welcome-field-label">{t('welcome.newParent')}</span>
                <span className="welcome-parent-row">
                  <input
                    type="text"
                    className="welcome-input"
                    data-testid="welcome-new-parent"
                    value={parent}
                    spellCheck={false}
                    onChange={(event) => {
                      setParent(event.target.value);
                      setError(null);
                    }}
                  />
                  <button
                    type="button"
                    className="bar-btn"
                    data-testid="welcome-new-parent-change"
                    onClick={changeParent}
                  >
                    {t('welcome.newParentChange')}
                  </button>
                </span>
              </label>
              <label className="welcome-check">
                <input
                  type="checkbox"
                  data-testid="welcome-new-git"
                  checked={initGit}
                  onChange={(event) => setInitGit(event.target.checked)}
                />
                <span>
                  {t('welcome.newGit')}
                  <span className="welcome-check-hint">{t('welcome.newGitHint')}</span>
                </span>
              </label>
              {/* Podgląd ścieżki: „Utwórz" przestaje być skokiem w ciemno. */}
              {target && (
                <p className="welcome-preview" data-testid="welcome-new-preview">
                  {tf('welcome.newPreview', { path: target })}
                </p>
              )}
              {error && (
                <p className="welcome-error" data-testid="welcome-new-error">
                  {error}
                </p>
              )}
              <div className="welcome-new-buttons">
                <button
                  type="button"
                  className="bar-btn"
                  data-testid="welcome-new-cancel"
                  onClick={() => {
                    setCreating(false);
                    setError(null);
                  }}
                >
                  {t('welcome.newCancel')}
                </button>
                <button
                  type="submit"
                  className="welcome-submit"
                  data-testid="welcome-new-submit"
                  disabled={busy || problem !== null || parent.trim() === ''}
                >
                  {t('welcome.newSubmit')}
                </button>
              </div>
            </form>
          )}
          {recents.length === 0 && !creating && (
            <p className="welcome-recents-empty" data-testid="welcome-recents-empty">
              {t('welcome.recentsEmpty')}
            </p>
          )}
          {recents.length > 0 && (
            <div className="welcome-recents">
              <h3 className="welcome-recents-title">{t('welcome.recents')}</h3>
              <div className="welcome-recent-list">
                {recents.map((path) => (
                  <button
                    key={path}
                    type="button"
                    className="welcome-recent"
                    data-testid="welcome-recent"
                    title={path}
                    onClick={() => pickRecent(path)}
                  >
                    <ProjectMark path={path} icon={icons[path] ?? null} />
                    <span className="welcome-recent-text">
                      <span className="welcome-recent-name">{baseName(path)}</span>
                      <span className="welcome-recent-path">{path}</span>
                    </span>
                    <span className="welcome-recent-go" aria-hidden>
                      ›
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
