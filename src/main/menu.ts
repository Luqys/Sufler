import { app, Menu, type MenuItemConstructorOptions } from 'electron';

/**
 * Natywne menu aplikacji (SPEC.md, M9): standardowe role (w tym Edycja —
 * bez niej nie działają Cmd+C/V w polach tekstowych) plus Ustawienia pod Cmd+,.
 */
export function installAppMenu(openSettings: () => void): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: app.name,
      submenu: [
        { role: 'about', label: `O aplikacji ${app.name}` },
        { type: 'separator' },
        {
          label: 'Ustawienia…',
          accelerator: 'CommandOrControl+,',
          click: openSettings,
        },
        { type: 'separator' },
        { role: 'services', label: 'Usługi' },
        { type: 'separator' },
        { role: 'hide', label: `Ukryj ${app.name}` },
        { role: 'hideOthers', label: 'Ukryj pozostałe' },
        { role: 'unhide', label: 'Pokaż wszystkie' },
        { type: 'separator' },
        { role: 'quit', label: `Zakończ ${app.name}` },
      ],
    },
    {
      label: 'Edycja',
      submenu: [
        { role: 'undo', label: 'Cofnij' },
        { role: 'redo', label: 'Przywróć' },
        { type: 'separator' },
        { role: 'cut', label: 'Wytnij' },
        { role: 'copy', label: 'Skopiuj' },
        { role: 'paste', label: 'Wklej' },
        { role: 'selectAll', label: 'Zaznacz wszystko' },
      ],
    },
    {
      label: 'Widok',
      submenu: [
        { role: 'reload', label: 'Przeładuj' },
        { role: 'toggleDevTools', label: 'Narzędzia deweloperskie' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pełny ekran' },
      ],
    },
    {
      label: 'Okno',
      submenu: [
        { role: 'minimize', label: 'Zminimalizuj' },
        { role: 'zoom', label: 'Powiększ' },
        { type: 'separator' },
        { role: 'front', label: 'Wszystkie na wierzch' },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
