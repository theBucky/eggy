import { app, dialog, ipcMain, nativeTheme, type IpcMainInvokeEvent } from 'electron'
import { homedir } from 'node:os'
import type { Events, Launch, Requests } from '$shared/ipc'
import * as apps from './apps'
import * as brew from './brew'
import * as git from './git'
import * as optimize from './optimize'
import { installMenu } from './menu'
import { restoreTheme, setTheme } from './theme'
import { createWindow } from './window'

type Handlers = {
  [Channel in keyof Requests]: (
    event: IpcMainInvokeEvent,
    ...args: Parameters<Requests[Channel]>
  ) => ReturnType<Requests[Channel]> | Promise<ReturnType<Requests[Channel]>>
}

app.whenReady().then(() => {
  restoreTheme()

  ipcMain.on('launch', (event) => {
    event.returnValue = { home: homedir(), theme: nativeTheme.themeSource } satisfies Launch
  })

  const { window, pane } = createWindow()

  function send<Channel extends keyof Events>(channel: Channel, ...args: Events[Channel]): void {
    if (!window.isDestroyed()) window.webContents.send(channel, ...args)
  }

  installMenu((command) => {
    window.show()
    send('menuCommand', command)
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
    upgradeApp: (_, path) => apps.upgrade(path, (progress) => send('appProgress', path, progress)),
    forceAppUpgrade: (_, path) => apps.forceUpgrade(path),
    discardAppUpgrade: (_, path) => apps.discardUpgrade(path),
    listPackages: () => brew.list(),
    checkPackages: () => brew.check(),
    upgradePackage: (_, kind, fullName) =>
      brew.upgrade(kind, fullName, (text) => send('packageOutput', kind, fullName, text)),
    setTheme: (_, theme) => setTheme(theme),
    inspectMachine: () => optimize.inspectMachine(),
    optimize: (_, optimizations) =>
      optimize.run(optimizations, (optimization, state) =>
        send('optimization', optimization, state)
      ),
    review: (_, target) => optimize.review(target)
  }

  for (const [channel, handler] of Object.entries(handlers)) ipcMain.handle(channel, handler)
})

app.on('will-quit', apps.discardWaiting)
