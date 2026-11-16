<script lang="ts" module>
  import type { PullCommand } from '$shared/api'

  const labels = {
    pull: { idle: 'Pull', running: 'Pulling' },
    rebase: { idle: 'Rebase and pull', running: 'Rebasing' }
  } satisfies Record<PullCommand, { idle: string; running: string }>
</script>

<script lang="ts">
  import { Button, type ButtonProps } from '$lib/components/ui/button'
  import { pendingPull, type Entry, type Repos } from '$lib/repos/repos.svelte'

  let {
    repos,
    entry,
    command,
    ...button
  }: { repos: Repos; entry: Entry; command: PullCommand } & Pick<ButtonProps, 'size' | 'variant'> =
    $props()

  const label = $derived(labels[command])
</script>

<Button {...button} disabled={!repos.canPull(entry)} onclick={() => repos.pull([entry], command)}>
  {#if entry.task?.status === 'queued'}
    Queued
  {:else if pendingPull(entry) === command}
    {label.running}
  {:else}
    {label.idle}
  {/if}
</Button>
