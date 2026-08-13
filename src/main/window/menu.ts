import { app, Menu, type MenuItemConstructorOptions } from 'electron';
import type { Language } from '../../shared/project/appearance';
import { stringsFor, type StringKey } from '../../shared/i18n';
import type { LayoutVisibilityKey } from '../../shared/docks/layout';

/**
 * Natywne menu aplikacji (SPEC.md, M9): standardowe role (w tym Edycja —
 * bez niej nie działają Cmd+C/V w polach tekstowych) plus Ustawienia pod Cmd+,.
 * Przebudowywane przy zmianie języka UI (patrz index.ts, AppearanceSet).
 */
export function installAppMenu(
  language: Language,
  openSettings: () => void,
  togglePanel: (key: LayoutVisibilityKey) => void,
): void {
  const strings = stringsFor(language);
  const t = (key: StringKey): string => strings[key].replace('{app}', app.name);

  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about', label: t('menu.about') },
        { type: 'separator' },
        {
          label: t('menu.settings'),
          accelerator: 'CommandOrControl+,',
          click: openSettings,
        },
        { type: 'separator' },
        { role: 'services', label: t('menu.services') },
        { type: 'separator' },
        { role: 'hide', label: t('menu.hide') },
        { role: 'hideOthers', label: t('menu.hideOthers') },
        { role: 'unhide', label: t('menu.unhide') },
        { type: 'separator' },
        { role: 'quit', label: t('menu.quit') },
      ],
    },
    {
      label: t('menu.edit'),
      submenu: [
        { role: 'undo', label: t('menu.undo') },
        { role: 'redo', label: t('menu.redo') },
        { type: 'separator' },
        { role: 'cut', label: t('menu.cut') },
        { role: 'copy', label: t('menu.copy') },
        { role: 'paste', label: t('menu.paste') },
        { role: 'selectAll', label: t('menu.selectAll') },
      ],
    },
    {
      label: t('menu.view'),
      submenu: [
        {
          label: t('menu.toggleSidebar'),
          accelerator: 'CommandOrControl+B',
          click: () => togglePanel('sidebarVisible'),
        },
        {
          label: t('menu.toggleBottom'),
          accelerator: 'Control+`',
          click: () => togglePanel('bottomDockVisible'),
        },
        {
          label: t('menu.toggleRight'),
          accelerator: 'CommandOrControl+Shift+C',
          click: () => togglePanel('rightDockVisible'),
        },
        { type: 'separator' },
        { role: 'reload', label: t('menu.reload') },
        { role: 'toggleDevTools', label: t('menu.devtools') },
        { type: 'separator' },
        { role: 'togglefullscreen', label: t('menu.fullscreen') },
      ],
    },
    {
      label: t('menu.window'),
      submenu: [
        { role: 'minimize', label: t('menu.minimize') },
        { role: 'zoom', label: t('menu.zoom') },
        { type: 'separator' },
        { role: 'front', label: t('menu.front') },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
