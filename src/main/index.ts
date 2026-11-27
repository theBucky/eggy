import { app, ipcMain } from 'electron'
import type { Handlers } from '$platform/ipc'
import type { Requests } from '$shared/ipc'
import * as apps from './apps'
import * as optimize from './optimize'
import * as packages from './packages'
import * as repos from './repos'
import * as shell from './shell'

app.whenReady().then(() => {
  const { window, send, handlers: shellHandlers } = shell.open()

  const handlers: Handlers<Requests> = {
    ...shellHandlers,
    ...apps.handlers(send),
    ...optimize.handlers(send),
    ...packages.handlers(send),
    ...repos.handlers(window)
  }

  for (const [channel, handler] of Object.entries(handlers)) ipcMain.handle(channel, handler)
})

app.on('will-quit', apps.discardWaiting)
