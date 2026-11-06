<script lang="ts">
  import { Button, type ButtonSize } from '$lib/components/ui/button'
  import { Spinner } from '$lib/components/ui/spinner'
  import type { Apps, Entry } from '$lib/apps/apps.svelte'
  import './update-button.css'

  let { apps, entry, size }: { apps: Apps; entry: Entry; size: ButtonSize } = $props()

  const progress = $derived(
    entry.task?.command === 'update' && entry.task.status === 'running'
      ? entry.task.progress
      : undefined
  )
</script>

<Button
  {size}
  data-progress={progress?.stage === 'install' ? 100 : progress?.percent}
  disabled={apps.busy}
  onclick={() => apps.update([entry])}
>
  {#if progress?.stage === 'install'}
    <Spinner data-icon="inline-start" />
    Installing
  {:else if progress}
    <Spinner data-icon="inline-start" />
    Downloading
  {:else}
    Update
  {/if}
</Button>
