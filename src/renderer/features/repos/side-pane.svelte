<script lang="ts" generics="Item">
  import { untrack, type Snippet } from 'svelte'
  import { invoke } from '$client/api'

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

  let shown = $state.raw<Item>()
  let sliding = $state.raw<{ width: string; content: number }>()

  let destroyed = false

  const revealed = $derived(item !== undefined && sliding === undefined)

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
    invoke('planWindowCollapse').then(() => invoke('moveWindow'))
  })

  async function slide(open: boolean): Promise<void> {
    const from = open ? 0 : wrapper!.getBoundingClientRect().width

    sliding = { width: `${from}px`, content: open ? PANE_WIDTH : from }

    const grown = open
      ? await invoke('planWindowExpansion', PANE_WIDTH - COLUMN_SHARE)
      : await invoke('planWindowCollapse')

    if (destroyed) return

    const to = open ? Math.min(PANE_WIDTH, layout.clientWidth + grown - COLUMN_MIN_WIDTH) : 0
    const content = Math.max(from, to)

    if (grown === 0) {
      sliding = { width: `${to}px`, content }
      await wrapper!.animate([{ width: `${from}px` }, { width: `${to}px` }], {
        duration: 200,
        easing: 'ease-in-out'
      }).finished
    } else {
      const rate = (to - from) / grown

      sliding = { width: `calc(${from}px + (100vw - ${window.innerWidth}px) * ${rate})`, content }
      await invoke('moveWindow')
    }

    if (destroyed) return

    if ((item !== undefined) !== open) return slide(item !== undefined)

    sliding = undefined

    if (!open) shown = undefined
  }
</script>

<div bind:this={layout} class="absolute inset-0 flex">
  <div class="relative flex-1" style:min-width="{COLUMN_MIN_WIDTH}px">
    {@render children()}
  </div>

  {#if shown !== undefined}
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
