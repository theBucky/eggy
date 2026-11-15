<script lang="ts" module>
  import type { ButtonVariant } from '$lib/components/ui/button'
  import type { PullCommand } from '$shared/api'

  const looks = {
    pull: { variant: 'default', idle: 'Pull', running: 'Pulling' },
    rebase: { variant: 'destructive', idle: 'Rebase and pull', running: 'Rebasing' }
  } satisfies Record<PullCommand, { variant: ButtonVariant; idle: string; running: string }>
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

  const look = $derived(looks[command])
</script>

<Button
  variant={look.variant}
  {...button}
  disabled={repos.busy}
  onclick={() => repos.pull([entry], command)}
>
  {runningPull(entry) === command ? look.running : look.idle}
</Button>
