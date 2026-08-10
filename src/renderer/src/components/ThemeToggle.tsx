import { useEffect, useState, type ReactElement } from 'react';

const ICON_SUN = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
    <circle cx="8" cy="8" r="3.2" />
    <path d="M8 1.2v1.8M8 13v1.8M1.2 8H3M13 8h1.8M3.2 3.2l1.3 1.3M11.5 11.5l1.3 1.3M12.8 3.2l-1.3 1.3M4.5 11.5l-1.3 1.3" />
  </svg>
);

const ICON_MOON = (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round">
    <path d="M13.3 9.9A5.9 5.9 0 0 1 6.1 2.7a5.9 5.9 0 1 0 7.2 7.2Z" />
  </svg>
);

/**
 * Szybkie przełączanie jasny↔ciemny (nadpisuje tryb w ustawieniach; powrót
 * do „Systemowy" przez Cmd+,). Akcent zostaje nietknięty.
 */
export function ThemeToggle(): ReactElement {
  const [dark, setDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches);

  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)');
    const onChange = (): void => setDark(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const toggle = (): void => {
    void window.api.getAppearance().then((appearance) => {
      void window.api.setAppearance({ ...appearance, mode: dark ? 'light' : 'dark' });
    });
  };

  return (
    <button
      type="button"
      className="titlebar-btn"
      data-testid="theme-quick-toggle"
      title={dark ? 'Przełącz na motyw jasny' : 'Przełącz na motyw ciemny'}
      onClick={toggle}
    >
      {dark ? ICON_SUN : ICON_MOON}
    </button>
  );
}
