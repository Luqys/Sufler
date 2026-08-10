import { useEffect, useState, type ReactElement } from 'react';
import { baseName } from '../../../shared/paths';

interface WelcomeScreenProps {
  onPicked(root: string): void;
}

const ICON_FOLDER = (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
    <path d="M1.8 4a1.2 1.2 0 0 1 1.2-1.2h3l1.6 1.7h5.4A1.2 1.2 0 0 1 14.2 5.7v6.3a1.2 1.2 0 0 1-1.2 1.2H3a1.2 1.2 0 0 1-1.2-1.2V4Z" />
  </svg>
);

const ICON_OPEN = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 3.2v9.6M3.2 8h9.6" />
  </svg>
);

/**
 * Ekran startowy: przy każdym uruchomieniu użytkownik wybiera folder roboczy.
 * Terminale i sesje Claude będą startować właśnie w nim.
 */
export function WelcomeScreen({ onPicked }: WelcomeScreenProps): ReactElement {
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    void window.api.getRecentRoots().then(setRecents);
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
      <header className="titlebar">VisualN3O</header>
      <div className="welcome" data-testid="welcome">
        <div className="welcome-card">
          <div className="welcome-hero">
            <div className="welcome-mark" aria-hidden>
              ✳
            </div>
            <div className="welcome-logo">VisualN3O</div>
            <p className="welcome-sub">
              Wybierz folder, w którym chcesz pracować — terminale i sesje Claude
              wystartują właśnie w nim.
            </p>
          </div>
          <button type="button" className="welcome-open" data-testid="welcome-open" onClick={browse}>
            {ICON_OPEN}
            Otwórz folder…
          </button>
          {recents.length > 0 && (
            <div className="welcome-recents">
              <h3 className="welcome-recents-title">Ostatnie</h3>
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
                    <span className="welcome-recent-icon">{ICON_FOLDER}</span>
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
