import { app, BrowserWindow, Menu, nativeImage, session, shell, Tray } from 'electron';
import log from 'electron-log/main';
import path from 'node:path';
import { registerIpcHandlers } from './ipc-handlers';
import { SecureStore } from './secure-store';
import { ServiceManager } from './service-manager';
import type { AgentStatus } from '../../../shared/ts/ipc';

log.initialize();
log.transports.file.level = 'info';

const DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL ?? 'http://localhost:5174';
const isDev = !app.isPackaged;
// The in-process mock is a development aid only: never honoured in packaged builds.
const forceMock = isDev && (process.env.WORKPULSE_MOCK_SERVICE === '1' || process.argv.includes('--mock'));

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;

const store = new SecureStore();
const services = new ServiceManager({ forceMock, allowMockFallback: isDev, log });

// A second instance just focuses the existing window.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());
  app.whenReady().then(bootstrap).catch((error) => {
    log.error('Startup failed', error);
    app.quit();
  });
}

function bootstrap(): void {
  hardenSession();
  registerIpcHandlers(services, store, () => mainWindow);
  createTray();
  createWindow();
  services.on('status', updateTray);
  services.start();
  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: store.load().startAtLogin, args: ['--hidden'] });
  }
}

function hardenSession(): void {
  const csp = isDev
    ? "default-src 'self' http://localhost:5174 ws://localhost:5174; script-src 'self' http://localhost:5174 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; connect-src 'self' http://localhost:5174 ws://localhost:5174"
    : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data:; connect-src 'self'";
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders, 'Content-Security-Policy': [csp] } });
  });
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 820,
    minHeight: 600,
    show: !process.argv.includes('--hidden'),
    title: 'WorkPulse Agent',
    backgroundColor: '#F6F6F2',
    autoHideMenuBar: true,
    icon: iconPath('icon.png'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
      spellcheck: false,
    },
  });
  Menu.setApplicationMenu(null);

  // Navigation is locked to the app itself; every external link goes to the OS browser.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url)) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) {
        void shell.openExternal(url);
      }
    }
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.on('close', (event) => {
    if (!quitting && store.load().minimizeToTray) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  void loadRenderer(mainWindow);
}

async function loadRenderer(window: BrowserWindow): Promise<void> {
  if (isDev) {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        await window.loadURL(DEV_SERVER_URL);
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    log.warn('Vite dev server not reachable; loading built renderer instead');
  }
  await window.loadFile(path.join(__dirname, '../../../../dist/index.html'));
}

function isAppUrl(url: string): boolean {
  return url.startsWith('file://') || (isDev && url.startsWith(DEV_SERVER_URL));
}

function iconPath(name: string): string {
  return app.isPackaged ? path.join(process.resourcesPath, 'assets', name) : path.join(__dirname, '../../../../assets', name);
}

function createTray(): void {
  const image = nativeImage.createFromPath(iconPath('tray.png'));
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image.resize({ width: 16, height: 16 }));
  tray.setToolTip('WorkPulse Agent');
  tray.on('click', () => showWindow());
  updateTray(services.currentStatus());
}

function updateTray(status: AgentStatus): void {
  if (!tray) {
    return;
  }
  const label = monitoringLabel(status);
  tray.setToolTip(`WorkPulse Agent – ${label}`);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `Monitoring: ${label}`, enabled: false },
      { label: status.currentApp ? `Current app: ${status.currentApp.appName}` : 'No application sampled', enabled: false },
      { type: 'separator' },
      { label: 'Open WorkPulse Agent', click: () => showWindow() },
      { label: 'Sync now', click: () => void services.request('sync.now', {}, 60000).catch((e) => log.warn('Sync failed', e)) },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
}

function monitoringLabel(status: AgentStatus): string {
  switch (status.monitoring) {
    case 'ACTIVE':
      return status.onBreak ? 'On break' : 'Active';
    case 'PAUSED_OUTSIDE_WINDOW':
      return 'Paused (outside working hours)';
    case 'STOPPED':
      return 'Stopped';
    case 'REVOKED':
      return 'Device revoked';
    case 'PENDING_APPROVAL':
      return 'Awaiting approval';
    default:
      return services.isConnected() ? 'Not registered' : 'Service not reachable';
  }
}

function showWindow(): void {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

app.on('before-quit', () => {
  quitting = true;
  services.stop();
});

app.on('window-all-closed', () => {
  // Keep running in the tray: the agent must stay visible while monitoring.
});

app.on('activate', () => showWindow());
