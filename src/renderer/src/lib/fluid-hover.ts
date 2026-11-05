import type { Attachment } from 'svelte/attachments'
import { on } from 'svelte/events'
import './fluid-hover.css'

type Point = { x: number; y: number }

// reach must exceed half the gap between rows to keep the highlight on while crossing.
const REACH = 12

function distance(point: Point, box: DOMRect): number {
  const dx = Math.max(box.left - point.x, 0, point.x - box.right)
  const dy = Math.max(box.top - point.y, 0, point.y - box.bottom)

  return Math.hypot(dx, dy)
}

export function fluidHover(selector: string): Attachment<HTMLElement> {
  return (container) => {
    let pointer: Point | undefined
    let lit: HTMLElement | undefined
    // A press that slides off one item onto another releases on their shared ancestor, which
    // would otherwise read as a gap click.
    let pressedGap = false

    function pick(): HTMLElement | undefined {
      if (!pointer) return

      let nearest: HTMLElement | undefined
      let reach = REACH

      for (const item of container.querySelectorAll<HTMLElement>(selector)) {
        // Collapsed content stays mounted, hidden.
        if (!item.checkVisibility()) continue

        const gap = distance(pointer, item.getBoundingClientRect())

        if (gap < reach) {
          reach = gap
          nearest = item
        }
      }

      return nearest?.matches('a[href], button:enabled') ? nearest : undefined
    }

    function update(): void {
      const shown = lit !== undefined

      lit = pick()

      if (lit === undefined) {
        container.dataset.fluidHover = 'none'

        return
      }

      container.dataset.fluidHover = shown ? 'move' : 'enter'

      const origin = container.getBoundingClientRect()
      const box = lit.getBoundingClientRect()

      container.style.setProperty('--hover-x', `${box.left - origin.left}px`)
      container.style.setProperty('--hover-y', `${box.top - origin.top}px`)
      container.style.setProperty('--hover-width', `${box.width}px`)
      container.style.setProperty('--hover-height', `${box.height}px`)
    }

    function track(event: PointerEvent): void {
      pointer = { x: event.clientX, y: event.clientY }
      update()
    }

    function inGap(target: EventTarget | null): boolean {
      return target instanceof Element && !target.closest(selector)
    }

    // Items also move under a still pointer when the list scrolls or resizes. Chromium then fires
    // `pointerover` once a new element lands under the pointer, but no `pointermove`.
    const observer = new ResizeObserver(update)

    const listeners = [
      on(container, 'pointerover', track),
      on(container, 'pointermove', track),
      on(container, 'pointerleave', () => {
        pointer = undefined
        update()
      }),
      on(container, 'pointerdown', (event) => {
        pressedGap = inGap(event.target)
      }),
      on(container, 'click', (event) => {
        if (lit && pressedGap && inGap(event.target)) lit.click()
      }),
      on(document, 'scroll', update, { capture: true })
    ]

    observer.observe(container)

    return () => {
      observer.disconnect()

      for (const off of listeners) off()
    }
  }
}
