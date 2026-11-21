import { app, BrowserWindow, nativeTheme, shell, type Rectangle } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { is } from '@electron-toolkit/utils'
import * as z from 'zod'
import { installContextMenu } from './menu'
import { resizer, type Resizer } from './resizer'

const SavedBounds = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number()
})

const path = join(app.getPath('userData'), 'window')

function savedBounds(): Rectangle | undefined {
  try {
    return SavedBounds.parse(JSON.parse(readFileSync(path, 'utf8')))
  } catch {
    return undefined
  }
}

// Matches `--sidebar` in main.css, so a resize never flashes another color past the page.
function sidebarColor(): string {
  return nativeTheme.shouldUseDarkColors ? '#101010' : '#f5f5f5'
}

type MainWindow = { window: BrowserWindow; pane: Resizer }

export function createWindow(): MainWindow {
  const window = new BrowserWindow({
    width: 1150,
    height: 760,
    ...savedBounds(),
    minWidth: 1150,
    minHeight: 760,
    show: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 18, y: 18 },
    backgroundColor: sidebarColor(),
    webPreferences: {
      preload: join(import.meta.dirname, '../preload/index.cjs'),
      spellcheck: false
    }
  })

  const pane = resizer(window)

  installContextMenu(window)

  nativeTheme.on('updated', () => window.setBackgroundColor(sidebarColor()))

  window.once('ready-to-show', () => window.show())

  let quitting = false

  app.on('before-quit', () => {
    quitting = true
  })

  window.on('close', (event) => {
    // Hiding keeps the renderer, so an upgrade underway still reports its progress and asks before
    // it force quits.
    if (!quitting) {
      event.preventDefault()
      window.hide()
    }

    // The next launch opens without a side pane, so the bounds are saved without the room made for
    // one.
    writeFileSync(path, JSON.stringify(pane.collapsed(window.getNormalBounds())))
  })

  app.on('activate', () => window.show())

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (['http:', 'https:'].includes(new URL(url).protocol)) shell.openExternal(url)

    return { action: 'deny' }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    window.loadFile(join(import.meta.dirname, '../renderer/index.html'))
  }

  return { window, pane }
}
