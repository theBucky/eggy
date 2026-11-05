import { app, shell, BrowserWindow, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { join } from 'node:path'
import { optimizer, is } from '@electron-toolkit/utils'
import type { Ipc } from '../shared/api'
import * as git from './git'
import * as sparkle from './sparkle'

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
  pull: (_, path, command) => git.pull(path, command),
  listApps: () => sparkle.listApps(),
  check: (_, path) => sparkle.check(path),
  update: (event, path) =>
    sparkle.update(path, (progress) => event.sender.send('progress', path, progress)),
  forceUpdate: (_, path) => sparkle.forceUpdate(path),
  discardUpdate: (_, path) => sparkle.discardUpdate(path)
}

// Set once the app quits, after which its window really closes.
let quitting = false

function createWindow(): BrowserWindow {
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

  // Hiding keeps the renderer, so an update underway still reports its progress and asks before it
  // force quits.
  mainWindow.on('close', (event) => {
    if (quitting) return

    event.preventDefault()
    mainWindow.hide()
  })

  // Release notes come from third-party feeds, so only web links leave the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (['http:', 'https:'].includes(new URL(url).protocol)) shell.openExternal(url)

    return { action: 'deny' }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }

  return mainWindow
}

app.whenReady().then(() => {
  for (const [channel, handler] of Object.entries(handlers)) ipcMain.handle(channel, handler)

  const window = createWindow()

  app.on('activate', () => window.show())
})

app.on('before-quit', () => {
  quitting = true
})
