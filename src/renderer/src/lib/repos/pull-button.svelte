<script lang="ts" module>
  import type { PullCommand } from '$shared/repos'

  const labels = {
    pull: { idle: 'Pull', running: 'Pulling' },
    rebase: { idle: 'Rebase and pull', running: 'Rebasing' }
  } satisfies Record<PullCommand, { idle: string; running: string }>
</script>

<script lang="ts">
  import { Button, type ButtonVariant } from '$lib/components/ui/button'
  import { pendingPull, type Entry, type Repos } from '$lib/repos/repos.svelte'

  let {
    repos,
    entry,
    command,
    variant
  }: { repos: Repos; entry: Entry; command: PullCommand; variant?: ButtonVariant } = $props()
</script>

<Button
  {variant}
  disabled={!repos.canUpgrade(entry)}
  onclick={() => repos.upgrade([entry], command)}
>
  {#if pendingPull(entry) !== command}
    {labels[command].idle}
  {:else if entry.task?.status === 'queued'}
    Queued
  {:else}
    {labels[command].running}
  {/if}
</Button>
