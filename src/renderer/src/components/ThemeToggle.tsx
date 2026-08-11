import { useEffect, useRef, useState, type ReactElement } from 'react';
import { ACCENTS, type AccentId } from '../../../shared/appearance';
import { applyAccent, applyAppearance, FLAVOR_EVENT, isDarkTheme } from '../appearance-client';
import { useT } from '../i18n';

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

const LONG_PRESS_MS = 500;

/**
 * Klik: jasny↔ciemny (akcent nietknięty; „Systemowy" wraca przez Cmd+,).
 * Przytrzymanie (albo prawy klik): wybór koloru przewodniego.
 */
export function ThemeToggle(): ReactElement {
  const t = useT();
  const [dark, setDark] = useState(isDarkTheme);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [currentAccent, setCurrentAccent] = useState<AccentId>('clay');
  const pressTimer = useRef<number | null>(null);
  const longPressFired = useRef(false);

  useEffect(() => {
    // Stan przycisku podąża za motywem aplikacji, nie za samym systemem.
    const onChange = (): void => setDark(isDarkTheme());
    window.addEventListener(FLAVOR_EVENT, onChange);
    return () => window.removeEventListener(FLAVOR_EVENT, onChange);
  }, []);

  const openPicker = (): void => {
    void window.api.getAppearance().then((appearance) => {
      setCurrentAccent(appearance.accent);
      setPickerOpen(true);
    });
  };

  const clearTimer = (): void => {
    if (pressTimer.current !== null) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  // Klik wychodzi też z trybu Matrix (to wariant ciemnego → przełącza na jasny).
  const toggleTheme = (): void => {
    void window.api.getAppearance().then((appearance) => {
      // Pełne zastosowanie lokalne jak w SettingsView: paleta wisi na
      // data-theme, a nasłuch systemowy milczy poza trybem „Systemowy".
      const next = { ...appearance, mode: dark ? ('light' as const) : ('dark' as const) };
      applyAppearance(next);
      void window.api.setAppearance(next);
    });
  };

  const pickAccent = (accent: AccentId): void => {
    setPickerOpen(false);
    applyAccent(accent);
    void window.api.getAppearance().then((appearance) => {
      void window.api.setAppearance({ ...appearance, accent });
    });
  };

  return (
    <div className="theme-toggle-wrap">
      <button
        type="button"
        className="titlebar-btn"
        data-testid="theme-quick-toggle"
        title={(dark ? t('themeToggle.toLight') : t('themeToggle.toDark')) + t('themeToggle.holdHint')}
        onPointerDown={() => {
          longPressFired.current = false;
          clearTimer();
          pressTimer.current = window.setTimeout(() => {
            longPressFired.current = true;
            openPicker();
          }, LONG_PRESS_MS);
        }}
        onPointerUp={clearTimer}
        onPointerLeave={clearTimer}
        onClick={() => {
          if (longPressFired.current) {
            longPressFired.current = false;
            return;
          }
          toggleTheme();
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          openPicker();
        }}
      >
        {dark ? ICON_SUN : ICON_MOON}
      </button>
      {pickerOpen && (
        <>
          <div className="menu-backdrop" onClick={() => setPickerOpen(false)} />
          <div className="accent-popover" data-testid="accent-popover">
            <span className="accent-popover-title">{t('themeToggle.accentTitle')}</span>
            <div className="settings-actions">
              {ACCENTS.map((accent) => (
                <button
                  key={accent.id}
                  type="button"
                  className={`accent-swatch${currentAccent === accent.id ? ' active' : ''}`}
                  data-testid={`accent-pick-${accent.id}`}
                  title={t(`accent.${accent.id}`)}
                  style={{ background: accent.swatch }}
                  onClick={() => pickAccent(accent.id)}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
