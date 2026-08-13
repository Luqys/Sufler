import type { ReactElement } from 'react';
import type { StringKey } from '../../../../shared/i18n';
import type { LayoutState, LayoutVisibilityKey } from '../../../../shared/docks/layout';
import { useT } from '../../i18n';

/**
 * Przełączniki paneli na pasku tytułu (à la VS Code): wypełniony segment =
 * panel widoczny, sama kreska = schowany. Klik przełącza.
 */

export function PanelGlyph({
  side,
  on,
}: {
  side: 'left' | 'bottom' | 'right';
  on: boolean;
}): ReactElement {
  let segment: ReactElement;
  let divider: ReactElement;
  if (side === 'left') {
    segment = <rect x="2.4" y="3.6" width="3.9" height="8.8" />;
    divider = <line x1="6.3" y1="3" x2="6.3" y2="13" />;
  } else if (side === 'right') {
    segment = <rect x="9.7" y="3.6" width="3.9" height="8.8" />;
    divider = <line x1="9.7" y1="3" x2="9.7" y2="13" />;
  } else {
    segment = <rect x="2.4" y="9.2" width="11.2" height="3.2" />;
    divider = <line x1="1.8" y1="9.2" x2="14.2" y2="9.2" />;
  }
  return (
    <svg width="16" height="16" viewBox="0 0 16 16">
      <rect
        x="1.8"
        y="3"
        width="12.4"
        height="10"
        rx="1.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      {on ? (
        <g fill="currentColor" opacity="0.55">
          {segment}
        </g>
      ) : (
        <g stroke="currentColor" strokeWidth="1.1" opacity="0.7">
          {divider}
        </g>
      )}
    </svg>
  );
}

const TOGGLES: Array<{
  key: LayoutVisibilityKey;
  side: 'left' | 'bottom' | 'right';
  testId: string;
  labelKey: StringKey;
}> = [
  {
    key: 'sidebarVisible',
    side: 'left',
    testId: 'layout-toggle-sidebar',
    labelKey: 'layout.sidebar',
  },
  {
    key: 'bottomDockVisible',
    side: 'bottom',
    testId: 'layout-toggle-bottom',
    labelKey: 'layout.bottom',
  },
  {
    key: 'rightDockVisible',
    side: 'right',
    testId: 'layout-toggle-right',
    labelKey: 'layout.right',
  },
];

interface LayoutTogglesProps {
  layout: LayoutState;
  onToggle(key: LayoutVisibilityKey): void;
}

export function LayoutToggles({ layout, onToggle }: LayoutTogglesProps): ReactElement {
  const t = useT();
  return (
    <>
      {TOGGLES.map((toggle) => {
        const visible = layout[toggle.key];
        return (
          <button
            key={toggle.key}
            type="button"
            className={`titlebar-btn${visible ? ' on' : ''}`}
            data-testid={toggle.testId}
            title={`${visible ? t('layout.hide') : t('layout.show')}: ${t(toggle.labelKey)}`}
            aria-pressed={visible}
            onClick={() => onToggle(toggle.key)}
          >
            <PanelGlyph side={toggle.side} on={visible} />
          </button>
        );
      })}
    </>
  );
}
