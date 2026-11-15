<script lang="ts">
  import { Button, type ButtonProps } from '$lib/components/ui/button'
  import type { Apps, Entry } from '$lib/apps/apps.svelte'
  import './upgrade-button.css'

  let {
    apps,
    entry,
    ...button
  }: { apps: Apps; entry: Entry } & Pick<ButtonProps, 'size' | 'variant'> = $props()

  const progress = $derived(
    entry.task?.command === 'upgrade' && entry.task.status === 'running'
      ? entry.task.progress
      : undefined
  )
</script>

<Button
  {...button}
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
