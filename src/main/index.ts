import {
  app,
  shell,
  BrowserWindow,
  dialog,
  ipcMain,
  type IpcMainInvokeEvent,
  type WebContents
} from 'electron'
import { join } from 'node:path'
import { optimizer, is } from '@electron-toolkit/utils'
import type { Events, Ipc } from '../shared/api'
import * as apps from './apps/upgrader'
import * as git from './git'
import { resizer } from './window'

type Handlers = {
  [Channel in keyof Ipc]: (
    event: IpcMainInvokeEvent,
    ...args: Parameters<Ipc[Channel]>
  ) => ReturnType<Ipc[Channel]>
}

function send<Channel extends keyof Events>(
  contents: WebContents,
  channel: Channel,
  ...args: Events[Channel]
): void {
  contents.send(channel, ...args)
}

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

  // Hiding keeps the renderer, so an upgrade underway still reports its progress and asks before it
  // force quits.
  mainWindow.on('close', (event) => {
    if (quitting) return

    event.preventDefault()
    mainWindow.hide()
  })

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
  const window = createWindow()
  const pane = resizer(window)

  const handlers: Handlers = {
    chooseRoot: async (_, current) => {
      const { canceled, filePaths } = await dialog.showOpenDialog(window, {
        defaultPath: current,
        properties: ['openDirectory']
      })

      return canceled ? undefined : filePaths[0]
    },
    scan: (_, root) => git.scan(root),
    fetch: (_, path) => git.fetch(path),
    pull: (_, path, command) => git.pull(path, command),
    show: (_, path, hash) => git.show(path, hash),
    expandWindow: async (_, width) => pane.expand(width),
    collapseWindow: async () => pane.collapse(),
    moveWindow: async () => pane.move(),
    listApps: () => apps.listApps(),
    check: (_, path) => apps.check(path),
    upgrade: (event, path) =>
      apps.upgrade(path, (progress) => send(event.sender, 'progress', path, progress)),
    forceUpgrade: (_, path) => apps.forceUpgrade(path),
    discardUpgrade: (_, path) => apps.discardUpgrade(path)
  }

  for (const [channel, handler] of Object.entries(handlers)) ipcMain.handle(channel, handler)

  app.on('activate', () => window.show())
})

app.on('before-quit', () => {
  quitting = true
})

app.on('will-quit', apps.discardWaiting)
