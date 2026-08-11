import { useEffect, useState, type CSSProperties, type ReactElement } from 'react';
import { baseName } from '../../../shared/paths';
import { projectHue, projectMonogram } from '../../../shared/project-icon';
import { useT } from '../i18n';

interface WelcomeScreenProps {
  onPicked(root: string): void;
}

const ICON_OPEN = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3.2v9.6M3.2 8h9.6" />
  </svg>
);

/** Znak Suflera: dymek podpowiedzi z zachętą wiersza poleceń, w kolorze akcentu. */
const ICON_MARK = (
  <svg
    width="40"
    height="40"
    viewBox="0 0 48 48"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.6"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M15 10h18a7 7 0 0 1 7 7v9a7 7 0 0 1-7 7H23l-8 6.5V33a7 7 0 0 1-7-7v-9a7 7 0 0 1 7-7Z" />
    <path d="m16.5 17.5 5.5 4.75-5.5 4.75" />
    <path d="M25.5 27h6" />
  </svg>
);

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

export function WelcomeScreen({ onPicked }: WelcomeScreenProps): ReactElement {
  const t = useT();
  const [recents, setRecents] = useState<string[]>([]);
  const [icons, setIcons] = useState<Record<string, string | null>>({});

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

  return (
    <div className="shell">
      <header className="titlebar">Sufler</header>
      <div className="welcome" data-testid="welcome">
        <div className="welcome-card">
          <div className="welcome-hero">
            <span className="welcome-mark-halo" aria-hidden>
              <span className="welcome-mark">{ICON_MARK}</span>
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
          <button type="button" className="welcome-open" data-testid="welcome-open" onClick={browse}>
            {ICON_OPEN}
            {t('welcome.open')}
          </button>
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
