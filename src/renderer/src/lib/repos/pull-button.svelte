<script lang="ts">
  import { Button, type ButtonSize } from '$lib/components/ui/button'
  import { Spinner } from '$lib/components/ui/spinner'
  import type { Entry, Workspace } from '$lib/repos/workspace.svelte'
  import type { PullCommand } from '$shared/api'

  let {
    workspace,
    entry,
    command,
    size
  }: { workspace: Workspace; entry: Entry; command: PullCommand; size: ButtonSize } = $props()

  const running = $derived(entry.task?.command === command && entry.task.status === 'running')
</script>

<Button
  {size}
  variant={command === 'rebase' ? 'destructive' : 'default'}
  disabled={workspace.busy}
  onclick={() => workspace.pull(entry, command)}
>
  {#if running}
    <Spinner data-icon="inline-start" />
    {command === 'rebase' ? 'Rebasing' : 'Pulling'}
  {:else}
    {command === 'rebase' ? 'Rebase and pull' : 'Pull'}
  {/if}
</Button>
