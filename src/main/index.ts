import { app, shell, BrowserWindow, dialog, ipcMain } from 'electron'
import { join } from 'node:path'
import { optimizer, is } from '@electron-toolkit/utils'
import { fetch, pull, scan } from './git'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 800,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 17, y: 17 },
    backgroundColor: '#f5f5f5',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.mjs'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)

    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  ipcMain.handle('choose-root', async (event, current: string) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(
      BrowserWindow.fromWebContents(event.sender)!,
      { defaultPath: current, properties: ['openDirectory'] }
    )

    return canceled ? undefined : filePaths[0]
  })
  ipcMain.handle('scan', (_, root: string) => scan(root))
  ipcMain.handle('fetch', (_, path: string) => fetch(path))
  ipcMain.handle('pull', (_, path: string) => pull(path))

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// macOS apps stay active in the dock after their last window closes;
// registering a no-op listener stops Electron's default quit.
app.on('window-all-closed', () => {})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
