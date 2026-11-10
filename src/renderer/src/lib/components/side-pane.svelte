<script lang="ts" generics="Item">
  import { untrack, type Snippet } from 'svelte'

  // The pane's width, of which the column gives up `COLUMN_SHARE` and the window grows by the rest,
  // so the app stays narrow enough to sit on most screens.
  const PANE_WIDTH = 640
  const COLUMN_SHARE = 240
  const COLUMN_MIN_WIDTH = 384

  let {
    item,
    children,
    pane
  }: {
    item: Item | undefined
    children: Snippet
    pane: Snippet<[Item, boolean]>
  } = $props()

  let layout: HTMLElement
  let wrapper = $state<HTMLElement>()

  // The pane keeps showing its last item while it slides shut.
  let shown = $state.raw<Item>()
  let sliding = $state.raw<{ width: string; content: number }>()

  let destroyed = false

  const revealed = $derived(item !== undefined && sliding === undefined)

  // A slide under way runs to its end before turning, since the window's move can't turn midway.
  $effect(() => {
    const next = item

    untrack(() => {
      const open = next !== undefined
      const opened = shown !== undefined

      if (open) shown = next

      if (sliding === undefined && open !== opened) slide(open)
    })
  })

  $effect(() => () => {
    destroyed = true
    window.api.planWindowCollapse().then(() => window.api.moveWindow())
  })

  async function slide(open: boolean): Promise<void> {
    const from = open ? 0 : wrapper!.getBoundingClientRect().width

    sliding = { width: `${from}px`, content: open ? PANE_WIDTH : from }

    const grown = open
      ? await window.api.planWindowExpansion(PANE_WIDTH - COLUMN_SHARE)
      : await window.api.planWindowCollapse()

    if (destroyed) return

    // The layout takes all the window's growth, since the sidebar keeps its width.
    const to = open ? Math.min(PANE_WIDTH, layout.clientWidth + grown - COLUMN_MIN_WIDTH) : 0
    const content = Math.max(from, to)

    // Without the window's move to pace it, the slide plays the system's resize animation itself.
    if (grown === 0) {
      sliding = { width: `${to}px`, content }
      await wrapper!.animate([{ width: `${from}px` }, { width: `${to}px` }], {
        duration: 200,
        easing: 'ease-in-out'
      }).finished
    } else {
      // The pane's width follows the window's through each frame of the system's animation.
      const rate = (to - from) / grown

      sliding = { width: `calc(${from}px + (100vw - ${window.innerWidth}px) * ${rate})`, content }
      await window.api.moveWindow()
    }

    if (destroyed) return

    if ((item !== undefined) !== open) return slide(item !== undefined)

    sliding = undefined

    if (!open) shown = undefined
  }
</script>

<div bind:this={layout} class="absolute inset-0 flex">
  <div class="flex flex-1 flex-col" style:min-width="{COLUMN_MIN_WIDTH}px">
    {@render children()}
  </div>

  {#if shown !== undefined}
    <!-- Mid-slide, the pane content keeps its open width and rides the window's edge, and the
         wrapper's border stands in for the content's own, which sits just past the clip. -->
    <div
      bind:this={wrapper}
      class={['relative min-w-0', sliding && 'flex-none overflow-hidden border-l']}
      style:width={sliding?.width ?? `${PANE_WIDTH}px`}
    >
      <div
        class={[sliding ? 'absolute inset-y-0 right-0' : 'size-full', 'border-l']}
        style:width={sliding ? `${sliding.content}px` : undefined}
      >
        {@render pane(shown, revealed)}
      </div>
    </div>
  {/if}
</div>
