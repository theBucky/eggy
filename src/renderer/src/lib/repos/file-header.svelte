<script lang="ts">
  import type { FileDiffMetadata } from '@pierre/diffs'
  import IconChevronRight from '@tabler/icons-svelte/icons/chevron-right'
  import * as Collapsible from '$lib/components/ui/collapsible'
  import { changesOf, HEADER_HEIGHT } from '$lib/repos/diff-viewer'
  import { cn } from '$lib/utils'

  let {
    fileDiff,
    open,
    ontoggle
  }: { fileDiff: FileDiffMetadata; open: boolean; ontoggle: (open: boolean) => void } = $props()

  const directory = $derived(fileDiff.name.slice(0, fileDiff.name.lastIndexOf('/') + 1))
  const { additions, deletions } = $derived(changesOf(fileDiff.hunks))
</script>

<Collapsible.Root bind:open={() => open, ontoggle}>
  <Collapsible.Trigger
    class={[
      'flex w-full items-center justify-between gap-3 border-y px-5 font-mono text-xs text-muted-foreground outline-none select-none focus-visible:bg-muted',
      !open && 'border-b-transparent'
    ]}
    style="height: {HEADER_HEIGHT}px"
  >
    <span class="flex min-w-0 items-center gap-2">
      <IconChevronRight
        class={cn(
          'size-3 shrink-0 transition-transform duration-collapsible ease-out-expo',
          open && 'rotate-90'
        )}
      />
      <span class="truncate" dir="rtl">
        <bdi>
          {#if fileDiff.prevName}{fileDiff.prevName} →
          {/if}{directory}<span class="text-foreground"
            >{fileDiff.name.slice(directory.length)}</span
          >
        </bdi>
      </span>
    </span>
    <span class="flex gap-2">
      {#if additions > 0}
        <span class="text-added">+{additions}</span>
      {/if}
      {#if deletions > 0}
        <span class="text-removed">-{deletions}</span>
      {/if}
    </span>
  </Collapsible.Trigger>
</Collapsible.Root>
