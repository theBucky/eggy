<script lang="ts">
  import { Button, type ButtonSize } from '$lib/components/ui/button'
  import type { Apps, Entry } from '$lib/apps/apps.svelte'
  import './upgrade-button.css'

  let { apps, entry, size }: { apps: Apps; entry: Entry; size: ButtonSize } = $props()

  const progress = $derived(
    entry.task?.command === 'upgrade' && entry.task.status === 'running'
      ? entry.task.progress
      : undefined
  )
</script>

<Button
  {size}
  data-progress={progress?.stage === 'install' ? 100 : progress?.percent}
  disabled={apps.busy}
  onclick={() => apps.upgrade([entry])}
>
  {#if progress?.stage === 'install'}
    Installing
  {:else if progress}
    Downloading
  {:else}
    Upgrade
  {/if}
</Button>
