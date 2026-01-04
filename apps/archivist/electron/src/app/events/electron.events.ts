/**
 * This module is responsible on handling all the inter process communications
 * between the frontend to the electron backend.
 */

import { app, BrowserWindow, ipcMain } from 'electron';
import { environment } from '../../environments/environment';
import { registerIpcHandlers } from '../api/ipc.handlers';

export default class ElectronEvents {
  static bootstrapElectronEvents(mainWindow?: BrowserWindow): Electron.IpcMain {
    if (mainWindow) {
      registerIpcHandlers(mainWindow);
    }
    return ipcMain;
  }
}

// Retrieve app version
ipcMain.handle('get-app-version', () => {
  console.log(`Fetching application version... [v${environment.version}]`);
  return environment.version;
});

// Handle App termination
ipcMain.on('quit', (_event, code) => {
  app.exit(code);
});
