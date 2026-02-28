import { IPC_CHANNELS } from '@medularity/archivist-core';
import { BrowserWindow, ipcMain, screen, shell } from 'electron';
import { join } from 'path';
import { format } from 'url';
import { environment } from '../environments/environment';
import { rendererAppName, rendererAppPort } from './constants';
import {
  createApplicationMenu,
  updateFileMenuForSelection,
} from './services/menu.service';

export default class App {
  // Keep a global reference of the window object, if you don't, the window will
  // be closed automatically when the JavaScript object is garbage collected.
  static mainWindow: BrowserWindow | null = null;
  static splashWindow: BrowserWindow | null = null;
  static application: Electron.App;
  static BrowserWindow: typeof BrowserWindow;

  public static isDevelopmentMode(): boolean {
    const isEnvironmentSet: boolean = 'ELECTRON_IS_DEV' in process.env;
    const getFromEnvironment: boolean =
      parseInt(process.env.ELECTRON_IS_DEV ?? '0', 10) === 1;

    return isEnvironmentSet ? getFromEnvironment : !environment.production;
  }

  private static onWindowAllClosed(): void {
    if (process.platform !== 'darwin') {
      App.application.quit();
    }
  }

  private static onClose(): void {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    App.mainWindow = null;
  }

  private static onRedirect(event: Electron.Event, url: string): void {
    if (url !== App.mainWindow.webContents.getURL()) {
      // this is a normal external redirect, open it in a new browser window
      event.preventDefault();
      shell.openExternal(url);
    }
  }

  private static onReady(): void {
    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    if (rendererAppName) {
      App.initMainWindow();
      App.loadMainWindow();
    }
  }

  private static onActivate(): void {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (App.mainWindow === null) {
      App.onReady();
    }
  }

  private static initMainWindow(): void {
    const workAreaSize = screen.getPrimaryDisplay().workAreaSize;
    const width = Math.min(1280, workAreaSize.width || 1280);
    const height = Math.min(720, workAreaSize.height || 720);

    // Create the splash window
    App.splashWindow = new BrowserWindow({
      width: 400,
      height: 340,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      webPreferences: {
        contextIsolation: true,
      },
    });

    App.splashWindow.loadURL(
      format({
        pathname: join(__dirname, 'assets', 'splash.html'),
        protocol: 'file:',
        slashes: true,
      }),
    );
    App.splashWindow.center();

    // Create the browser window.
    App.mainWindow = new BrowserWindow({
      width: width,
      height: height,
      show: false,
      webPreferences: {
        contextIsolation: true,
        backgroundThrottling: false,
        preload: join(__dirname, 'main.preload.js'),
      },
    });

    // Create application menu
    createApplicationMenu(App.mainWindow);

    // Handle menu updates from renderer based on selection
    ipcMain.on(
      'update-menu-selection',
      (
        _event: Electron.IpcMainEvent,
        hasSelection: boolean,
        isSingleFile: boolean,
      ) => {
        updateFileMenuForSelection(App.mainWindow, hasSelection, isSingleFile);
      },
    );

    ipcMain.on(IPC_CHANNELS.PRELOAD_LOG, (_event, msg) => {
      console.log(msg);
    });

    App.mainWindow.center();

    // Capture start time for splash screen delay calculation
    const startTime = Date.now();
    let transitionScheduled = false;

    // Dismiss splash as soon as the Angular app signals it is ready.
    // Using only this single gate avoids a deadlock where ready-to-show
    // never fires in dev mode (Angular dev server not ready on first load).
    ipcMain.once(IPC_CHANNELS.APP_READY, () => {
      console.log('[App] Received app:ready signal from frontend');
      if (transitionScheduled) return;
      transitionScheduled = true;

      const minSplashDuration = 2000; // 2 seconds
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, minSplashDuration - elapsedTime);

      setTimeout(() => {
        console.log('[App] Splash screen transition timeout reached');
        if (App.splashWindow && !App.splashWindow.isDestroyed()) {
          console.log('[App] Closing splash window');
          App.splashWindow.destroy();
          App.splashWindow = null;
        }
        if (App.mainWindow && !App.mainWindow.isDestroyed()) {
          console.log('[App] Showing main window');
          App.mainWindow.show();
          App.mainWindow.focus();
        }
      }, remainingTime);
    });

    // Emitted when the window is closed.
    App.mainWindow.on('closed', () => {
      // Dereference the window object, usually you would store windows
      // in an array if your app supports multi windows, this is the time
      // when you should delete the corresponding element.
      App.mainWindow = null;
    });

    // Handle failed load in dev (e.g. server not ready)
    App.mainWindow.webContents.on('did-fail-load', () => {
      if (!App.application.isPackaged) {
        setTimeout(() => {
          if (App.mainWindow && !App.mainWindow.isDestroyed()) {
            App.loadMainWindow();
          }
        }, 1000);
      }
    });

    // Register IPC handlers after window is created
    console.log('[App] Bootstrapping Electron events...');
    import('./events/electron.events')
      .then((module) => {
        console.log('[App] Electron events imported successfully');
        module.default.bootstrapElectronEvents(App.mainWindow);
        console.log('[App] Electron events bootstrapped');
      })
      .catch((err) => {
        console.error('[App] Failed to bootstrap Electron events:', err);
      });
  }

  private static loadMainWindow(): void {
    // load the index.html of the app.
    if (!App.application.isPackaged) {
      App.mainWindow.loadURL(`http://localhost:${rendererAppPort}`);
    } else {
      App.mainWindow.loadURL(
        format({
          pathname: join(
            __dirname,
            '..',
            rendererAppName,
            'browser',
            'index.html',
          ),
          protocol: 'file:',
          slashes: true,
        }),
      );
    }
  }

  static main(app: Electron.App, browserWindow: typeof BrowserWindow): void {
    // we pass the Electron.App object and the
    // Electron.BrowserWindow into this function
    // so this class has no dependencies. This
    // makes the code easier to write tests for

    App.BrowserWindow = browserWindow;
    App.application = app;

    App.application.on('window-all-closed', App.onWindowAllClosed); // Quit when all windows are closed.
    App.application.on('ready', App.onReady); // App is ready to load data
    App.application.on('activate', App.onActivate); // App is activated
  }
}
