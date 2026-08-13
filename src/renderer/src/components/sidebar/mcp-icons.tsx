import type { ReactElement } from 'react';

/**
 * Ikony znanych serwerów MCP (uproszczone znaki, dopasowanie po nazwie).
 * Nieznane serwery dostają wtyczkę.
 */

const OBSIDIAN = (
  <svg width="15" height="15" viewBox="0 0 16 16" data-icon="obsidian">
    <path d="M8 1 L12.6 4.2 L11.4 12.4 L8 15 L4.3 12 L4.9 4.6 Z" fill="#7c3aed" />
    <path d="M8 1 L8 15 L4.3 12 L4.9 4.6 Z" fill="#a78bfa" />
  </svg>
);

const SUPABASE = (
  <svg width="15" height="15" viewBox="0 0 16 16" data-icon="supabase">
    <path d="M9.2 1.2 L2.6 9.4 h4.9 l-0.7 5.4 6.6-8.2 H8.5 Z" fill="#3ecf8e" />
  </svg>
);

const GITHUB = (
  <svg width="15" height="15" viewBox="0 0 16 16" data-icon="github">
    <circle cx="8" cy="8" r="6.6" fill="#8b8b96" />
    <text x="8" y="11" textAnchor="middle" fontSize="7" fontWeight={800} fill="#fff" fontFamily="-apple-system, sans-serif">GH</text>
  </svg>
);

function monogram(key: string, glyph: string, color: string): ReactElement {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" data-icon={key}>
      <rect x="1.2" y="1.2" width="13.6" height="13.6" rx="3.4" fill={color} />
      <text
        x="8"
        y="11.3"
        textAnchor="middle"
        fontSize="8"
        fontWeight={800}
        fill="#fff"
        fontFamily="-apple-system, sans-serif"
      >
        {glyph}
      </text>
    </svg>
  );
}

const DEFAULT_PLUG = (
  <svg width="15" height="15" viewBox="0 0 16 16" data-icon="mcp" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round">
    <path d="M5.8 1.5v3.2M10.2 1.5v3.2" />
    <path d="M4.2 4.7h7.6v2.8a3.8 3.8 0 0 1-7.6 0V4.7Z" />
    <path d="M8 11.3v3.2" />
  </svg>
);

const MATCHERS: Array<{ test: RegExp; icon: ReactElement }> = [
  { test: /obsidian/, icon: OBSIDIAN },
  { test: /supabase/, icon: SUPABASE },
  { test: /github|gh/, icon: GITHUB },
  { test: /slack/, icon: monogram('slack', '#', '#611f69') },
  { test: /notion/, icon: monogram('notion', 'N', '#37352f') },
  { test: /figma/, icon: monogram('figma', 'F', '#a259ff') },
  { test: /stripe/, icon: monogram('stripe', 'S', '#635bff') },
  { test: /postgres|pg\b/, icon: monogram('postgres', 'PG', '#336791') },
  { test: /docker/, icon: monogram('docker', 'D', '#0db7ed') },
  { test: /playwright|puppeteer|browser/, icon: monogram('playwright', 'PW', '#2ead33') },
  { test: /linear/, icon: monogram('linear', 'L', '#5e6ad2') },
  { test: /sentry/, icon: monogram('sentry', 'SE', '#362d59') },
  { test: /memory/, icon: monogram('memory', 'M', '#7c3aed') },
];

export function mcpIconFor(name: string): ReactElement {
  const lower = name.toLowerCase();
  for (const matcher of MATCHERS) {
    if (matcher.test.test(lower)) {
      return matcher.icon;
    }
  }
  return DEFAULT_PLUG;
}
