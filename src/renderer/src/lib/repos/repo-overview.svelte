<script lang="ts">
  import IconGitBranch from '@tabler/icons-svelte/icons/git-branch'
  import * as Empty from '$lib/components/ui/empty'
  import { Spinner } from '$lib/components/ui/spinner'
  import type { Status } from '$lib/components/status-dot.svelte'
  import { tilde } from '$lib/paths'
  import { statusOf, type Workspace } from '$lib/repos/workspace.svelte'

  let { workspace }: { workspace: Workspace } = $props()

  const labels = {
    running: 'syncing',
    outdated: 'outdated',
    failed: 'failed',
    updated: 'updated',
    current: 'up to date'
  } satisfies Record<Exclude<Status, 'unknown'>, string>

  const tally = $derived(
    Object.entries(labels)
      .flatMap(([status, label]) => {
        const count = workspace.entries.filter((entry) => statusOf(entry) === status).length

        return count > 0 ? [`${count} ${label}`] : []
      })
      .join(' · ')
  )
</script>

<Empty.Root>
  <Empty.Header>
    <Empty.Media variant="icon">
      {#if workspace.scanning}
        <Spinner />
      {:else}
        <IconGitBranch />
      {/if}
    </Empty.Media>
    {#if workspace.scanning}
      <Empty.Title>Scanning {tilde(workspace.root)}</Empty.Title>
    {:else if workspace.entries.length === 0}
      <Empty.Title>No repositories</Empty.Title>
      <Empty.Description>
        Nothing under {tilde(workspace.root)} tracks an upstream branch.
      </Empty.Description>
    {:else}
      <Empty.Title>{workspace.entries.length} repositories</Empty.Title>
      <Empty.Description>
        {tally || `Each tracks an upstream branch under ${tilde(workspace.root)}.`}
      </Empty.Description>
    {/if}
  </Empty.Header>
</Empty.Root>
