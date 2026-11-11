import { app, screen, systemPreferences, type BrowserWindow, type Rectangle } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as z from 'zod'

// Shortens the system's resize animation, which `move` plays, to about 200ms across a pane's width,
// from a default that drags.
systemPreferences.registerDefaults({ NSWindowResizeTime: 0.1 })

const SavedBounds = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number()
})

const path = join(app.getPath('userData'), 'window')

export function savedBounds(): Rectangle | undefined {
  try {
    return SavedBounds.parse(JSON.parse(readFileSync(path, 'utf8')))
  } catch {
    return undefined
  }
}

type Resizer = {
  planExpansion: (width: number) => number
  planCollapse: () => number
  move: () => void
}

// Grows the window to fit a side pane and shrinks it back, planning each move so the page learns how
// much it grows before the window starts moving.
export function resizer(window: BrowserWindow): Resizer {
  let expansion: { width: number; shift: number; deferred: boolean } | undefined
  let planned: Rectangle | undefined

  // Growth is in the page's own pixels, which its zoom scales.
  function plan(to: Rectangle): number {
    planned = to

    return (to.width - window.getBounds().width) / window.webContents.getZoomFactor()
  }

  function planExpansion(width: number): number {
    const bounds = planned ?? window.getBounds()

    if (expansion !== undefined) {
      expansion.deferred = false

      return 0
    }

    const area = screen.getDisplayMatching(bounds).workArea
    const right = Math.max(area.x + area.width - (bounds.x + bounds.width), 0)
    const left = Math.max(bounds.x - area.x, 0)
    const grown = Math.min(Math.round(width * window.webContents.getZoomFactor()), right + left)

    if (grown === 0) return 0

    const shift = Math.max(grown - right, 0)

    expansion = { width: grown, shift, deferred: false }

    return plan({ ...bounds, x: bounds.x - shift, width: bounds.width + grown })
  }

  function collapsed(bounds: Rectangle): Rectangle {
    if (expansion === undefined) return bounds

    const width = Math.min(expansion.width, bounds.width - window.getMinimumSize()[0])
    const shift = Math.min(expansion.shift, width)

    return { ...bounds, x: bounds.x + shift, width: bounds.width - width }
  }

  function planCollapse(): number {
    const bounds = planned ?? window.getBounds()

    if (expansion === undefined) return 0

    // A full screen window keeps its size, so collapsing waits until it leaves full screen.
    if (window.isFullScreen()) {
      expansion.deferred = true

      return 0
    }

    const to = collapsed(bounds)

    expansion = undefined

    if (to.width === bounds.width) return 0

    return plan(to)
  }

  // The system's own animation keeps pace with the display, where steps sent from the renderer drop
  // frames. It blocks until the window is there.
  function move(): void {
    if (planned === undefined) return

    const to = planned

    planned = undefined
    window.setBounds(to, true)
  }

  window.on('leave-full-screen', () => {
    if (!expansion?.deferred) return

    planCollapse()
    move()
  })

  // The next launch opens without a side pane, so the bounds are saved without the room made for one.
  window.on('close', () => {
    writeFileSync(path, JSON.stringify(collapsed(window.getNormalBounds())))
  })

  return { planExpansion, planCollapse, move }
}
