import {
  app,
  shell,
  BrowserWindow,
  dialog,
  ipcMain,
  nativeTheme,
  type IpcMainInvokeEvent,
  type WebContents
} from 'electron'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import type { Events, Ipc } from '$shared/api'
import * as apps from './apps'
import * as brew from './brew'
import * as git from './git'
import * as optimize from './optimize'
import { installContextMenu, installMenu } from './menu'
import { restoreTheme, setTheme, sidebarColor } from './theme'
import { resizer, savedBounds } from './window'

type Handlers = {
  [Channel in keyof Ipc]: (
    event: IpcMainInvokeEvent,
    ...args: Parameters<Ipc[Channel]>
  ) => ReturnType<Ipc[Channel]> | Awaited<ReturnType<Ipc[Channel]>>
}

function send<Channel extends keyof Events>(
  contents: WebContents,
  channel: Channel,
  ...args: Events[Channel]
): void {
  if (!contents.isDestroyed()) contents.send(channel, ...args)
}

let quitting = false

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1150,
    height: 760,
    ...savedBounds(),
    minWidth: 1150,
    minHeight: 760,
    show: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 17, y: 17 },
    backgroundColor: sidebarColor(),
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.mjs'),
      sandbox: false
    }
  })

  installContextMenu(mainWindow)

  nativeTheme.on('updated', () => mainWindow.setBackgroundColor(sidebarColor()))

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
  restoreTheme()

  // The preload reads the theme synchronously, before the page renders.
  ipcMain.on('theme', (event) => {
    event.returnValue = nativeTheme.themeSource
  })

  const window = createWindow()
  const pane = resizer(window)

  installMenu((command) => {
    window.show()
    send(window.webContents, 'menuCommand', command)
  })

  const handlers: Handlers = {
    chooseRoot: async (_, current) => {
      const { canceled, filePaths } = await dialog.showOpenDialog(window, {
        defaultPath: current,
        properties: ['openDirectory']
      })

      return canceled ? undefined : filePaths[0]
    },
    scanRepos: (_, root) => git.scan(root),
    fetchRepo: (_, path) => git.fetch(path),
    pullRepo: (_, path, command) => git.pull(path, command),
    showCommit: (_, path, hash) => git.show(path, hash),
    planWindowExpansion: (_, width) => pane.planExpansion(width),
    planWindowCollapse: () => pane.planCollapse(),
    moveWindow: () => pane.move(),
    listApps: () => apps.list(),
    checkApp: (_, path) => apps.check(path),
    upgradeApp: (event, path) =>
      apps.upgrade(path, (progress) => send(event.sender, 'appProgress', path, progress)),
    forceAppUpgrade: (_, path) => apps.forceUpgrade(path),
    discardAppUpgrade: (_, path) => apps.discardUpgrade(path),
    listPackages: () => brew.list(),
    checkPackages: () => brew.check(),
    upgradePackage: (event, kind, fullName) =>
      brew.upgrade(kind, fullName, (text) =>
        send(event.sender, 'packageOutput', kind, fullName, text)
      ),
    setTheme: (_, theme) => setTheme(theme),
    inspectMachine: () => optimize.inspectMachine(),
    optimize: (event, optimizations) =>
      optimize.run(optimizations, (optimization, state) =>
        send(event.sender, 'optimization', optimization, state)
      ),
    review: (_, target) => optimize.review(target)
  }

  for (const [channel, handler] of Object.entries(handlers)) ipcMain.handle(channel, handler)

  app.on('activate', () => window.show())
})

app.on('before-quit', () => {
  quitting = true
})

app.on('will-quit', apps.discardWaiting)
