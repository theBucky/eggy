<script lang="ts" module>
  export const HEADER_HEIGHT = 36
</script>

<script lang="ts">
  import type { FileDiffMetadata } from '@pierre/diffs'
  import IconChevronRight from '@tabler/icons-svelte/icons/chevron-right'
  import * as Collapsible from '$lib/components/ui/collapsible'
  import { cn } from '$lib/utils'

  let {
    fileDiff,
    open,
    ontoggle
  }: { fileDiff: FileDiffMetadata; open: boolean; ontoggle: (open: boolean) => void } = $props()

  const directory = $derived(fileDiff.name.slice(0, fileDiff.name.lastIndexOf('/') + 1))
  const additions = $derived(fileDiff.hunks.reduce((sum, hunk) => sum + hunk.additionLines, 0))
  const deletions = $derived(fileDiff.hunks.reduce((sum, hunk) => sum + hunk.deletionLines, 0))
</script>

<!-- The viewer hides the file's lines itself, so the collapsible has no content of its own. A
     folded file leaves its bottom border to the next file's top one but keeps the border's pixel,
     so the row holds still. -->
<Collapsible.Root bind:open={() => open, ontoggle}>
  <Collapsible.Trigger
    class={[
      'flex w-full items-center justify-between gap-3 border-y px-5 outline-none select-none focus-visible:bg-muted',
      !open && 'border-b-transparent'
    ]}
    style="height: {HEADER_HEIGHT}px"
  >
    <span class="flex min-w-0 items-center gap-2">
      <IconChevronRight
        stroke={1.5}
        class={cn(
          'size-3 shrink-0 text-muted-foreground transition-transform duration-collapsible ease-out-expo',
          open && 'rotate-90'
        )}
      />
      <!-- Right-to-left overflow keeps the file name in view and cuts the directories instead. -->
      <span class="truncate font-mono text-xs text-muted-foreground" dir="rtl">
        <bdi>
          {#if fileDiff.prevName}{fileDiff.prevName} →
          {/if}{directory}<span class="text-foreground"
            >{fileDiff.name.slice(directory.length)}</span
          >
        </bdi>
      </span>
    </span>
    <span class="flex shrink-0 gap-2 font-mono text-xs">
      {#if additions > 0}
        <span class="text-success">+{additions}</span>
      {/if}
      {#if deletions > 0}
        <span class="text-destructive">-{deletions}</span>
      {/if}
    </span>
  </Collapsible.Trigger>
</Collapsible.Root>
