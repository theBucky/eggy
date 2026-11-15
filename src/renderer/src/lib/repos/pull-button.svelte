<script lang="ts" module>
  import type { PullCommand } from '$shared/api'

  const labels = {
    pull: { idle: 'Pull', running: 'Pulling' },
    rebase: { idle: 'Rebase and pull', running: 'Rebasing' }
  } satisfies Record<PullCommand, { idle: string; running: string }>
</script>

<script lang="ts">
  import { Button, type ButtonProps } from '$lib/components/ui/button'
  import { runningPull, type Entry, type Repos } from '$lib/repos/repos.svelte'

  let {
    repos,
    entry,
    command,
    ...button
  }: { repos: Repos; entry: Entry; command: PullCommand } & Pick<ButtonProps, 'size' | 'variant'> =
    $props()

  const label = $derived(labels[command])
</script>

<Button {...button} disabled={repos.busy} onclick={() => repos.pull([entry], command)}>
  {runningPull(entry) === command ? label.running : label.idle}
</Button>
