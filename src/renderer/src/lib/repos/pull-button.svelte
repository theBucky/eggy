<script lang="ts" module>
  import type { ButtonVariant } from '$lib/components/ui/button'
  import type { PullCommand } from '$shared/api'

  const looks = {
    pull: { variant: 'default', idle: 'Pull', running: 'Pulling' },
    rebase: { variant: 'destructive', idle: 'Rebase and pull', running: 'Rebasing' }
  } satisfies Record<PullCommand, { variant: ButtonVariant; idle: string; running: string }>
</script>

<script lang="ts">
  import { Button, type ButtonSize } from '$lib/components/ui/button'
  import { runningPull, type Entry, type Repos } from '$lib/repos/repos.svelte'

  let {
    repos,
    entry,
    command,
    size
  }: { repos: Repos; entry: Entry; command: PullCommand; size: ButtonSize } = $props()

  const look = $derived(looks[command])
</script>

<Button
  {size}
  variant={look.variant}
  disabled={repos.busy}
  onclick={() => repos.pull([entry], command)}
>
  {runningPull(entry) === command ? look.running : look.idle}
</Button>
