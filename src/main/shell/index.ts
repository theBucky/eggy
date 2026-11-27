import { ipcMain, nativeTheme, type BrowserWindow } from 'electron'
import { homedir } from 'node:os'
import type { Handlers, Send } from '$platform/ipc'
import type { Events } from '$shared/ipc'
import type { Launch, Requests } from '$shared/shell'
import { installMenu } from './menu'
import { restoreTheme, setTheme } from './theme'
import { createWindow } from './window'

type Shell = {
  window: BrowserWindow
  send: Send<Events>
  handlers: Handlers<Requests>
}

export function open(): Shell {
  restoreTheme()

  ipcMain.on('launch', (event) => {
    event.returnValue = { home: homedir(), theme: nativeTheme.themeSource } satisfies Launch
  })

  const { window, pane } = createWindow()

  const send: Send<Events> = (channel, ...args) => {
    if (!window.isDestroyed()) window.webContents.send(channel, ...args)
  }

  installMenu((command) => {
    window.show()
    send('menuCommand', command)
  })

  return {
    window,
    send,
    handlers: {
      setTheme: (_, theme) => setTheme(theme),
      planWindowExpansion: (_, width) => pane.planExpansion(width),
      planWindowCollapse: () => pane.planCollapse(),
      moveWindow: () => pane.move()
    }
  }
}
