import type { ReactElement } from 'react';

/**
 * Kolorowe ikony wg typu pliku (à la Seti/VS Code): monogramy i proste glify.
 * Kolory są stałe niezależnie od motywu — jak w edytorach.
 */

interface IconSpec {
  key: string;
  glyph: string;
  color: string;
  fontSize?: number;
}

const BY_NAME: Record<string, IconSpec> = {
  'package.json': { key: 'npm', glyph: '{}', color: '#8bc34a', fontSize: 10 },
  'package-lock.json': { key: 'npm', glyph: '{}', color: '#8bc34a', fontSize: 10 },
  '.gitignore': { key: 'git', glyph: '◆', color: '#f1502f', fontSize: 11 },
  '.gitattributes': { key: 'git', glyph: '◆', color: '#f1502f', fontSize: 11 },
  'claude.md': { key: 'claude', glyph: '✳', color: '#d97757', fontSize: 11 },
  'claude.local.md': { key: 'claude', glyph: '✳', color: '#d97757', fontSize: 11 },
  dockerfile: { key: 'docker', glyph: 'D', color: '#0db7ed' },
  makefile: { key: 'make', glyph: 'M', color: '#e37933' },
};

const BY_EXT: Record<string, IconSpec> = {
  ts: { key: 'ts', glyph: 'TS', color: '#3178c6' },
  mts: { key: 'ts', glyph: 'TS', color: '#3178c6' },
  cts: { key: 'ts', glyph: 'TS', color: '#3178c6' },
  tsx: { key: 'tsx', glyph: 'TX', color: '#3178c6' },
  js: { key: 'js', glyph: 'JS', color: '#d4b830' },
  mjs: { key: 'js', glyph: 'JS', color: '#d4b830' },
  cjs: { key: 'js', glyph: 'JS', color: '#d4b830' },
  jsx: { key: 'jsx', glyph: 'JX', color: '#d4b830' },
  json: { key: 'json', glyph: '{}', color: '#cbcb41', fontSize: 10 },
  md: { key: 'md', glyph: 'M↓', color: '#519aba' },
  html: { key: 'html', glyph: '<>', color: '#e37933', fontSize: 10 },
  htm: { key: 'html', glyph: '<>', color: '#e37933', fontSize: 10 },
  css: { key: 'css', glyph: '#', color: '#519aba', fontSize: 11 },
  scss: { key: 'scss', glyph: '#', color: '#f55385', fontSize: 11 },
  sass: { key: 'scss', glyph: '#', color: '#f55385', fontSize: 11 },
  less: { key: 'css', glyph: '#', color: '#a074c4', fontSize: 11 },
  py: { key: 'py', glyph: 'PY', color: '#3572a5' },
  sh: { key: 'shell', glyph: '>_', color: '#89e051', fontSize: 9 },
  zsh: { key: 'shell', glyph: '>_', color: '#89e051', fontSize: 9 },
  bash: { key: 'shell', glyph: '>_', color: '#89e051', fontSize: 9 },
  yml: { key: 'yaml', glyph: 'Y', color: '#a074c4' },
  yaml: { key: 'yaml', glyph: 'Y', color: '#a074c4' },
  toml: { key: 'toml', glyph: 'T', color: '#9c4221' },
  rs: { key: 'rust', glyph: 'RS', color: '#dea584' },
  go: { key: 'go', glyph: 'GO', color: '#00add8' },
  java: { key: 'java', glyph: 'J', color: '#b07219' },
  rb: { key: 'ruby', glyph: 'RB', color: '#701516' },
  sql: { key: 'sql', glyph: 'Q', color: '#dad8d8' },
  pdf: { key: 'pdf', glyph: 'P', color: '#e34f4f' },
  lock: { key: 'lock', glyph: 'L', color: '#8a8a8a' },
};

const IMAGE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'avif']);

function monogram(spec: IconSpec): ReactElement {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" data-icon={spec.key}>
      <text
        x="8"
        y="12.2"
        textAnchor="middle"
        fontSize={spec.fontSize ?? 8.4}
        fontWeight={700}
        fontFamily="-apple-system, 'SF Pro Text', sans-serif"
        fill={spec.color}
      >
        {spec.glyph}
      </text>
    </svg>
  );
}

const IMAGE_ICON = (
  <svg width="15" height="15" viewBox="0 0 16 16" data-icon="image" fill="none" stroke="#6bbf59" strokeWidth="1.3">
    <rect x="2" y="3" width="12" height="10" rx="1.4" />
    <circle cx="5.6" cy="6.4" r="1.1" fill="#6bbf59" stroke="none" />
    <path d="M3.2 12l3.2-3.4 2.3 2.2 2.4-2.8 1.8 2.2" strokeLinejoin="round" />
  </svg>
);

const SVG_ICON = (
  <svg width="15" height="15" viewBox="0 0 16 16" data-icon="svg" fill="none" stroke="#ffb13b" strokeWidth="1.3">
    <rect x="2" y="3" width="12" height="10" rx="1.4" />
    <path d="M3.2 12l3.2-3.4 2.3 2.2 2.4-2.8 1.8 2.2" strokeLinejoin="round" />
  </svg>
);

const DEFAULT_ICON = (
  <svg width="14" height="14" viewBox="0 0 16 16" data-icon="file" fill="none" stroke="currentColor" strokeWidth="1.3">
    <path d="M4 1.8h5.2L13.5 6v7.2a1 1 0 0 1-1 1h-8.5a1 1 0 0 1-1-1V2.8a1 1 0 0 1 1-1Z" />
    <path d="M9.2 1.8V6h4.3" />
  </svg>
);

export const FOLDER_ICON = (
  <svg width="14" height="14" viewBox="0 0 16 16" data-icon="folder" fill="none" stroke="#8fa8bd" strokeWidth="1.3" strokeLinejoin="round">
    <path d="M1.8 4a1 1 0 0 1 1-1h3.5l1.5 1.7h6.4a1 1 0 0 1 1 1V12a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1V4Z" />
  </svg>
);

export function fileIconFor(name: string): ReactElement {
  const lower = name.toLowerCase();
  const byName = BY_NAME[lower];
  if (byName) {
    return monogram(byName);
  }
  const dot = lower.lastIndexOf('.');
  const ext = dot > 0 ? lower.slice(dot + 1) : '';
  if (IMAGE_EXT.has(ext)) {
    return IMAGE_ICON;
  }
  if (ext === 'svg') {
    return SVG_ICON;
  }
  const byExt = BY_EXT[ext];
  if (byExt) {
    return monogram(byExt);
  }
  return DEFAULT_ICON;
}
