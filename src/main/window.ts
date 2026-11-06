import { screen, systemPreferences, type BrowserWindow, type Rectangle } from 'electron'

// Shortens the system's resize animation, which `moveWindow` plays, to about 200ms across a pane's
// width, from a default that drags.
systemPreferences.registerDefaults({ NSWindowResizeTime: 0.1 })

// What expanding added, so collapsing undoes it even after the user moves the window. A full screen
// window keeps its size, so collapsing it is deferred until it leaves full screen.
let expansion: { width: number; shift: number; deferred: boolean } | undefined

let planned: Rectangle | undefined

// Plans the move to `to`, returning how much wider it makes the page, in the page's own pixels,
// which its zoom scales.
function plan(window: BrowserWindow, to: Rectangle): number {
  planned = to

  return (to.width - window.getBounds().width) / window.webContents.getZoomFactor()
}

// Plans growing the window to fit `width` more of the page, rightward first and then leftward, so a
// new pane takes screen space instead of squeezing the content beside it. Returns how much the page
// grows.
export function expandWindow(window: BrowserWindow, width: number): number {
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

  return plan(window, { ...bounds, x: bounds.x - shift, width: bounds.width + grown })
}

// Plans undoing `expandWindow` as far as the window's minimum width allows, after the user narrowed
// it, returning how much the page grows.
export function collapseWindow(window: BrowserWindow): number {
  const bounds = planned ?? window.getBounds()

  if (expansion === undefined) return 0

  if (window.isFullScreen()) {
    expansion.deferred = true

    return 0
  }

  const width = Math.min(expansion.width, bounds.width - window.getMinimumSize()[0])
  const shift = Math.min(expansion.shift, width)

  expansion = undefined

  if (width === 0) return 0

  return plan(window, { ...bounds, x: bounds.x + shift, width: bounds.width - width })
}

// Makes the planned move in the system's own animation, which keeps pace with the display where
// steps sent from the renderer drop frames. The animation blocks until the window is there.
export function moveWindow(window: BrowserWindow): void {
  if (planned === undefined) return

  const to = planned

  planned = undefined
  window.setBounds(to, true)
}

// Makes the collapse that full screen deferred, once the window has its own size back.
export function leaveFullScreen(window: BrowserWindow): void {
  if (!expansion?.deferred) return

  collapseWindow(window)
  moveWindow(window)
}
