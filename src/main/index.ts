import { app, shell, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { optimizer, is } from '@electron-toolkit/utils'
import type { Ipc } from '../shared/api'
import * as git from './git'

type Handlers = {
  [Channel in keyof Ipc]: (
    event: IpcMainInvokeEvent,
    ...args: Parameters<Ipc[Channel]>
  ) => ReturnType<Ipc[Channel]>
}

const handlers: Handlers = {
  chooseRoot: async (event, current) => {
    const { canceled, filePaths } = await dialog.showOpenDialog(
      BrowserWindow.fromWebContents(event.sender)!,
      { defaultPath: current, properties: ['openDirectory'] }
    )

    return canceled ? undefined : filePaths[0]
  },
  scan: (_, root) => git.scan(root),
  fetch: (_, path) => git.fetch(path),
  pull: (_, path) => git.pull(path)
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1150,
    height: 760,
    minWidth: 1150,
    minHeight: 760,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 17, y: 17 },
    // Matches `--sidebar` in main.css, so a resize never flashes another color past the page.
    backgroundColor: '#f5f5f5',
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.mjs'),
      sandbox: false
    }
  })

  optimizer.watchWindowShortcuts(mainWindow)

  mainWindow.once('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)

    return { action: 'deny' }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  for (const [channel, handler] of Object.entries(handlers)) ipcMain.handle(channel, handler)

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// macOS apps stay active in the dock after their last window closes;
// registering a no-op listener stops Electron's default quit.
app.on('window-all-closed', () => {})
