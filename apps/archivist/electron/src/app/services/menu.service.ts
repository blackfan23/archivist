/**
 * Menu service for creating the application menu
 * File actions send IPC messages to the renderer for handling
 */

import { app, BrowserWindow, Menu, MenuItemConstructorOptions } from 'electron';
import App from '../app';

/**
 * Creates and sets the application menu
 * @param mainWindow The main browser window to send IPC messages to
 */
export function createApplicationMenu(mainWindow: BrowserWindow): void {
  const isMac = process.platform === 'darwin';
  const isDev = App.isDevelopmentMode();

  const template: MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),

    // File menu
    {
      label: 'File',
      submenu: [
        isMac ? { role: 'close' as const } : { role: 'quit' as const },
      ],
    },

    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' as const },
              { role: 'delete' as const },
              { role: 'selectAll' as const },
            ]
          : [
              { role: 'delete' as const },
              { type: 'separator' as const },
              { role: 'selectAll' as const },
            ]),
      ],
    },

    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        // Only show toggle dev tools in development mode
        ...(isDev
          ? [
              { role: 'toggleDevTools' as const },
            ]
          : []),
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
      ],
    },

    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
              { type: 'separator' as const },
              { role: 'window' as const },
            ]
          : [{ role: 'close' as const }]),
      ],
    },

    // Help menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            const { shell } = await import('electron');
            await shell.openExternal('https://electronjs.org');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Updates the File menu with selection-based actions
 * Called when selection changes in the frontend
 */
export function updateFileMenuForSelection(
  mainWindow: BrowserWindow,
  hasSelection: boolean,
  isSingleFile: boolean,
): void {
  const isMac = process.platform === 'darwin';
  const isDev = App.isDevelopmentMode();

  const fileSubmenu: MenuItemConstructorOptions[] = [
    // Selection-based actions (only when files are selected)
    ...(hasSelection
      ? [
          {
            label: 'Show in Finder',
            accelerator: 'CmdOrCtrl+Shift+R',
            click: () => {
              mainWindow.webContents.send('menu-action', 'show-in-finder');
            },
          },
          { type: 'separator' as const },
        ]
      : []),

    // Single file actions
    ...(isSingleFile
      ? [
          {
            label: 'Edit in FFmpeg Editor',
            accelerator: 'CmdOrCtrl+E',
            click: () => {
              mainWindow.webContents.send('menu-action', 'edit');
            },
          },
          { type: 'separator' as const },
          {
            label: 'Requery Rating',
            click: () => {
              mainWindow.webContents.send('menu-action', 'requery-rating');
            },
          },
          {
            label: 'Match to TMDB',
            accelerator: 'CmdOrCtrl+M',
            click: () => {
              mainWindow.webContents.send('menu-action', 'match-tmdb');
            },
          },
          {
            label: 'Write Metadata',
            click: () => {
              mainWindow.webContents.send('menu-action', 'write-metadata');
            },
          },
          { type: 'separator' as const },
        ]
      : []),

    // Standard file menu items
    isMac
      ? { role: 'close' as const }
      : { role: 'quit' as const },
  ];

  const template: MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const },
            ],
          },
        ]
      : []),

    // File menu with dynamic items
    {
      label: 'File',
      submenu: fileSubmenu,
    },

    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' as const },
        { role: 'redo' as const },
        { type: 'separator' as const },
        { role: 'cut' as const },
        { role: 'copy' as const },
        { role: 'paste' as const },
        ...(isMac
          ? [
              { role: 'pasteAndMatchStyle' as const },
              { role: 'delete' as const },
              { role: 'selectAll' as const },
            ]
          : [
              { role: 'delete' as const },
              { type: 'separator' as const },
              { role: 'selectAll' as const },
            ]),
      ],
    },

    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' as const },
        { role: 'forceReload' as const },
        // Only show toggle dev tools in development mode
        ...(isDev
          ? [
              { role: 'toggleDevTools' as const },
            ]
          : []),
        { type: 'separator' as const },
        { role: 'resetZoom' as const },
        { role: 'zoomIn' as const },
        { role: 'zoomOut' as const },
        { type: 'separator' as const },
        { role: 'togglefullscreen' as const },
      ],
    },

    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' as const },
        { role: 'zoom' as const },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
              { type: 'separator' as const },
              { role: 'window' as const },
            ]
          : [{ role: 'close' as const }]),
      ],
    },

    // Help menu
    {
      label: 'Help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            const { shell } = await import('electron');
            await shell.openExternal('https://electronjs.org');
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
