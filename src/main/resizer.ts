import { screen, systemPreferences, type BrowserWindow, type Rectangle } from 'electron'

systemPreferences.registerDefaults({ NSWindowResizeTime: 0.1 })

export type Resizer = {
  planExpansion: (width: number) => number
  planCollapse: () => number
  move: () => void
  collapsed: (bounds: Rectangle) => Rectangle
}

export function resizer(window: BrowserWindow): Resizer {
  let expansion: { width: number; shift: number; deferred: boolean } | undefined
  let planned: Rectangle | undefined

  function plan(to: Rectangle): number {
    planned = to

    return (to.width - window.getBounds().width) / window.webContents.getZoomFactor()
  }

  function planExpansion(width: number): number {
    if (expansion !== undefined) {
      expansion.deferred = false

      return 0
    }

    const bounds = planned ?? window.getBounds()
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
    if (expansion === undefined) return 0

    if (window.isFullScreen()) {
      expansion.deferred = true

      return 0
    }

    const bounds = planned ?? window.getBounds()
    const to = collapsed(bounds)

    expansion = undefined

    if (to.width === bounds.width) return 0

    return plan(to)
  }

  // On macOS the animated bounds change blocks until the window reaches its destination.
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

  return { planExpansion, planCollapse, move, collapsed }
}
