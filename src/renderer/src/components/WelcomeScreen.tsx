import { useEffect, useState, type ReactElement } from 'react';
import { baseName } from '../../../shared/paths';

interface WelcomeScreenProps {
  onPicked(root: string): void;
}

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
          <div className="welcome-logo">VisualN3O</div>
          <p className="welcome-sub">
            Wybierz folder, w którym chcesz pracować — terminale i sesje Claude
            wystartują właśnie w nim.
          </p>
          <button type="button" className="welcome-open" data-testid="welcome-open" onClick={browse}>
            Otwórz folder…
          </button>
          {recents.length > 0 && (
            <div className="welcome-recents">
              <h3 className="view-title">Ostatnie</h3>
              {recents.map((path) => (
                <button
                  key={path}
                  type="button"
                  className="welcome-recent"
                  data-testid="welcome-recent"
                  title={path}
                  onClick={() => pickRecent(path)}
                >
                  <span className="welcome-recent-name">{baseName(path)}</span>
                  <span className="welcome-recent-path">{path}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
