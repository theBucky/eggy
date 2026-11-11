import { Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'
import { is } from '@electron-toolkit/utils'
import type { MenuCommand } from '$shared/api'

export function installMenu(run: (command: MenuCommand) => void): void {
  const developer: MenuItemConstructorOptions[] = [
    { type: 'separator' },
    { role: 'forceReload' },
    { role: 'toggleDevTools' }
  ]

  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        role: 'appMenu',
        submenu: [
          { role: 'about' },
          { type: 'separator' },
          { label: 'Settings…', accelerator: 'Command+,', click: () => run('settings') },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' }
        ]
      },
      { role: 'fileMenu' },
      { role: 'editMenu' },
      {
        role: 'viewMenu',
        submenu: [
          { label: 'Check for Upgrades', accelerator: 'Command+R', click: () => run('refresh') },
          { type: 'separator' },
          { role: 'togglefullscreen' },
          ...(is.dev ? developer : [])
        ]
      },
      { role: 'windowMenu' }
    ])
  )
}

// Chromium shows no menu of its own, which leaves selected text without the system's Copy.
export function installContextMenu(window: BrowserWindow): void {
  const copy = Menu.buildFromTemplate([{ role: 'copy' }])

  window.webContents.on('context-menu', (_, { selectionText }) => {
    if (selectionText !== '') copy.popup({ window })
  })
}
