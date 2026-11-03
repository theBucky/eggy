<script lang="ts">
  import IconChevronDown from '@tabler/icons-svelte/icons/chevron-down'
  import IconChevronRight from '@tabler/icons-svelte/icons/chevron-right'
  import IconCloudDownload from '@tabler/icons-svelte/icons/cloud-download'
  import IconFolder from '@tabler/icons-svelte/icons/folder'
  import IconFolderCog from '@tabler/icons-svelte/icons/folder-cog'
  import IconFolderOpen from '@tabler/icons-svelte/icons/folder-open'
  import IconGitBranch from '@tabler/icons-svelte/icons/git-branch'
  import IconRefresh from '@tabler/icons-svelte/icons/refresh'
  import { SvelteSet } from 'svelte/reactivity'
  import { Button } from '$lib/components/ui/button'
  import * as Collapsible from '$lib/components/ui/collapsible'
  import * as Empty from '$lib/components/ui/empty'
  import * as Sidebar from '$lib/components/ui/sidebar'
  import { Spinner } from '$lib/components/ui/spinner'
  import * as Tooltip from '$lib/components/ui/tooltip'
  import RepoDetail from '$lib/components/repo-detail.svelte'
  import { nameOf, tilde } from '$lib/paths'
  import { statusOf, Workspace, type Status } from '$lib/workspace.svelte'

  const workspace = new Workspace()
  let selected = $state<string>()
  let repositoriesOpen = $state(true)
  const expanded = new SvelteSet<string>()

  const current = $derived(workspace.entries.find((entry) => entry.repo.path === selected))

  const folders = $derived(
    [
      ...Map.groupBy(
        workspace.entries.toSorted((a, b) => a.repo.path.localeCompare(b.repo.path)),
        (entry) => entry.repo.path.slice(0, entry.repo.path.lastIndexOf('/'))
      )
    ].toSorted(([a], [b]) => a.localeCompare(b))
  )

  const dots = {
    unknown: 'bg-muted-foreground/30',
    failed: 'bg-destructive',
    outdated: 'bg-brand',
    updated: 'bg-success',
    current: 'bg-success'
  } satisfies Record<Exclude<Status, 'running'>, string>

  const outcomes = [
    ['running', 'syncing'],
    ['outdated', 'outdated'],
    ['failed', 'failed'],
    ['updated', 'updated'],
    ['current', 'up to date']
  ] as const

  const tally = $derived(
    outcomes
      .flatMap(([status, label]) => {
        const count = workspace.entries.filter((entry) => statusOf(entry) === status).length

        return count > 0 ? [`${count} ${label}`] : []
      })
      .join(' · ')
  )

  function setExpanded(dir: string, open: boolean): void {
    if (open) expanded.add(dir)
    else expanded.delete(dir)
  }

  workspace.scan()
</script>

<!-- Listed first so the no-drag controls below carve themselves out of it. -->
<div class="fixed inset-x-0 top-0 h-10 [-webkit-app-region:drag]"></div>

<Sidebar.Provider style="--sidebar-width: 18rem">
  <Sidebar.Root variant="inset">
    <!-- Keeps the sidebar content clear of the traffic lights. -->
    <div class="h-8 shrink-0"></div>

    <Sidebar.Content>
      <Collapsible.Root bind:open={repositoriesOpen}>
        {#snippet child({ props })}
          <Sidebar.Group {...props}>
            <div class="flex items-center gap-1">
              <Sidebar.GroupLabel class="flex-1">
                {#snippet child({ props })}
                  <Collapsible.Trigger {...props}>
                    Repositories
                    {#if repositoriesOpen}
                      <IconChevronDown />
                    {:else}
                      <IconChevronRight />
                    {/if}
                  </Collapsible.Trigger>
                {/snippet}
              </Sidebar.GroupLabel>
              <Tooltip.Root>
                <Tooltip.Trigger>
                  {#snippet child({ props })}
                    <Button
                      {...props}
                      variant="ghost"
                      size="icon"
                      aria-label="Change folder"
                      disabled={workspace.busy}
                      onclick={() => workspace.chooseRoot()}
                    >
                      <IconFolderCog stroke={1.5} />
                    </Button>
                  {/snippet}
                </Tooltip.Trigger>
                <Tooltip.Content>Change folder ({tilde(workspace.root)})</Tooltip.Content>
              </Tooltip.Root>
              <Tooltip.Root>
                <Tooltip.Trigger>
                  {#snippet child({ props })}
                    <Button
                      {...props}
                      variant="ghost"
                      size="icon"
                      aria-label="Refresh"
                      disabled={workspace.busy}
                      onclick={() => workspace.scan()}
                    >
                      {#if workspace.activity === 'scan' || workspace.activity === 'fetch'}
                        <Spinner />
                      {:else}
                        <IconRefresh stroke={1.5} />
                      {/if}
                    </Button>
                  {/snippet}
                </Tooltip.Trigger>
                <Tooltip.Content>Refresh</Tooltip.Content>
              </Tooltip.Root>
              <Tooltip.Root>
                <Tooltip.Trigger>
                  {#snippet child({ props })}
                    <Button
                      {...props}
                      variant="ghost"
                      size="icon"
                      aria-label="Pull outdated"
                      disabled={workspace.busy || workspace.outdated.length === 0}
                      onclick={() => workspace.pullAll()}
                    >
                      {#if workspace.activity === 'pull'}
                        <Spinner />
                      {:else}
                        <IconCloudDownload stroke={1.5} />
                      {/if}
                    </Button>
                  {/snippet}
                </Tooltip.Trigger>
                <Tooltip.Content>Pull {workspace.outdated.length} outdated</Tooltip.Content>
              </Tooltip.Root>
            </div>
            <Collapsible.Content class="pt-1">
              <Sidebar.Menu>
                {#each folders as [dir, entries] (dir)}
                  {@const open = expanded.has(dir)}
                  <Collapsible.Root bind:open={() => open, (value) => setExpanded(dir, value)}>
                    {#snippet child({ props })}
                      <Sidebar.MenuItem {...props}>
                        <Collapsible.Trigger>
                          {#snippet child({ props })}
                            <Sidebar.MenuButton {...props} size="sm">
                              {#if open}
                                <IconFolderOpen stroke={1.5} class="text-muted-foreground" />
                              {:else}
                                <IconFolder stroke={1.5} class="text-muted-foreground" />
                              {/if}
                              <span class="truncate">
                                {dir.startsWith(`${workspace.root}/`)
                                  ? dir.slice(workspace.root.length + 1)
                                  : tilde(dir)}
                              </span>
                              {#if !open}
                                {@const outdated = entries.filter(
                                  (entry) => statusOf(entry) === 'outdated'
                                ).length}
                                {#if outdated > 0}
                                  <span class="ml-auto text-xs text-brand">
                                    {outdated} outdated
                                  </span>
                                {/if}
                              {/if}
                            </Sidebar.MenuButton>
                          {/snippet}
                        </Collapsible.Trigger>
                        <Collapsible.Content class="pt-1 pb-3">
                          <Sidebar.Menu>
                            {#each entries as entry (entry.repo.path)}
                              {@const status = statusOf(entry)}
                              <Sidebar.MenuItem>
                                <Sidebar.MenuButton
                                  size="sm"
                                  isActive={entry.repo.path === selected}
                                  onclick={() => (selected = entry.repo.path)}
                                >
                                  <span
                                    class="flex size-4 shrink-0 items-center justify-center text-muted-foreground"
                                  >
                                    {#if status === 'running'}
                                      <Spinner />
                                    {:else}
                                      <span class={['size-1.5 rounded-full', dots[status]]}></span>
                                    {/if}
                                  </span>
                                  <span class="truncate">{nameOf(entry.repo.path)}</span>
                                  {#if status === 'failed'}
                                    <span class="ml-auto text-xs text-destructive">failed</span>
                                  {:else if status === 'outdated'}
                                    <span class="ml-auto font-mono text-xs text-brand">
                                      ↓{entry.repo.sync?.behind}
                                    </span>
                                  {:else if entry.task?.status === 'updated'}
                                    <span class="ml-auto font-mono text-xs text-success">
                                      +{entry.task.commits.length}
                                    </span>
                                  {/if}
                                </Sidebar.MenuButton>
                              </Sidebar.MenuItem>
                            {/each}
                          </Sidebar.Menu>
                        </Collapsible.Content>
                      </Sidebar.MenuItem>
                    {/snippet}
                  </Collapsible.Root>
                {/each}
              </Sidebar.Menu>
            </Collapsible.Content>
          </Sidebar.Group>
        {/snippet}
      </Collapsible.Root>
    </Sidebar.Content>
  </Sidebar.Root>

  <Sidebar.Inset>
    {#if current}
      <RepoDetail
        entry={current}
        disabled={workspace.busy}
        onpull={() => workspace.pull(current)}
      />
    {:else}
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
    {/if}
  </Sidebar.Inset>
</Sidebar.Provider>
