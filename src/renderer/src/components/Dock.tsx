import type { ReactElement } from 'react';

interface DockProps {
  id: 'right' | 'bottom';
  title: string;
}

/**
 * Wspólny komponent obu doków (prawego i dolnego) — patrz SPEC.md.
 * W M3 dostanie pasek zakładek, przycisk [+] i zawartość terminali.
 */
export function Dock({ id, title }: DockProps): ReactElement {
  return (
    <section className={`dock dock-${id}`} data-testid={`${id}-dock`}>
      <header className="dock-header">
        <span>{title}</span>
        <button type="button" className="dock-add" disabled title="Nowa zakładka — M3">
          +
        </button>
      </header>
      <div className="dock-body">
        <p className="placeholder">Zakładki terminali i sesji Claude pojawią się w M3–M4.</p>
      </div>
    </section>
  );
}
