<script lang="ts">
  import IconChevronRight from '@tabler/icons-svelte/icons/chevron-right'
  import IconCloudDownload from '@tabler/icons-svelte/icons/cloud-download'
  import IconFolder from '@tabler/icons-svelte/icons/folder'
  import IconFolderCog from '@tabler/icons-svelte/icons/folder-cog'
  import IconFolderOpen from '@tabler/icons-svelte/icons/folder-open'
  import IconRefresh from '@tabler/icons-svelte/icons/refresh'
  import { Tooltip as TooltipPrimitive } from 'bits-ui'
  import { SvelteSet } from 'svelte/reactivity'
  import { Button } from '$lib/components/ui/button'
  import * as Collapsible from '$lib/components/ui/collapsible'
  import * as Sidebar from '$lib/components/ui/sidebar'
  import { Spinner } from '$lib/components/ui/spinner'
  import * as Tooltip from '$lib/components/ui/tooltip'
  import { nameOf, tilde } from '$lib/paths'
  import { statusOf, type Status, type Workspace } from '$lib/repos/workspace.svelte'
  import { cn } from '$lib/utils'

  let {
    workspace,
    selected = $bindable()
  }: { workspace: Workspace; selected: string | undefined } = $props()

  // One tooltip moves between the toolbar buttons instead of each mounting its own.
  const toolbarTip = TooltipPrimitive.createTether<string>()

  let groupOpen = $state(true)
  const expanded = new SvelteSet<string>()

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
    outdated: 'bg-info',
    updated: 'bg-success',
    current: 'bg-success'
  } satisfies Record<Exclude<Status, 'running'>, string>

  function setExpanded(dir: string, open: boolean): void {
    if (open) expanded.add(dir)
    else expanded.delete(dir)
  }
</script>

<Collapsible.Root bind:open={groupOpen}>
  {#snippet child({ props })}
    <Sidebar.Group {...props}>
      <div class="flex items-center gap-1">
        <Sidebar.GroupLabel class="flex-1">
          {#snippet child({ props })}
            <Collapsible.Trigger {...props}>
              Repositories
              <IconChevronRight
                class={cn(
                  'transition-transform duration-collapsible ease-out-expo',
                  groupOpen && 'rotate-90'
                )}
              />
            </Collapsible.Trigger>
          {/snippet}
        </Sidebar.GroupLabel>
        <Tooltip.Trigger tether={toolbarTip} payload="Change folder">
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
        <Tooltip.Trigger tether={toolbarTip} payload="Refresh">
          {#snippet child({ props })}
            <Button
              {...props}
              variant="ghost"
              size="icon"
              aria-label="Refresh"
              disabled={workspace.busy}
              onclick={() => workspace.refresh()}
            >
              {#if workspace.activity === 'scan' || workspace.activity === 'fetch'}
                <Spinner />
              {:else}
                <IconRefresh stroke={1.5} />
              {/if}
            </Button>
          {/snippet}
        </Tooltip.Trigger>
        <Tooltip.Trigger tether={toolbarTip} payload={`Pull ${workspace.outdated.length} outdated`}>
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
        <Tooltip.Root tether={toolbarTip}>
          {#snippet children({ payload })}
            <Tooltip.Content>{payload}</Tooltip.Content>
          {/snippet}
        </Tooltip.Root>
      </div>
      <Collapsible.Content hiddenUntilFound>
        <Sidebar.Menu class="pt-1">
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
                        <span class="flex-1 truncate-fade">
                          {dir.startsWith(`${workspace.root}/`)
                            ? dir.slice(workspace.root.length + 1)
                            : tilde(dir)}
                        </span>
                        {#if !open}
                          {@const outdated = entries.filter(
                            (entry) => statusOf(entry) === 'outdated'
                          ).length}
                          {#if outdated > 0}
                            <span class="text-xs text-muted-foreground">{outdated} outdated</span>
                          {/if}
                        {/if}
                      </Sidebar.MenuButton>
                    {/snippet}
                  </Collapsible.Trigger>
                  <Collapsible.Content hiddenUntilFound>
                    <Sidebar.Menu class="pt-1 pb-3">
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
                            <span class="flex-1 truncate-fade">{nameOf(entry.repo.path)}</span>
                            {#if status === 'failed'}
                              <span class="text-xs text-destructive">failed</span>
                            {:else if status === 'outdated'}
                              <span class="font-mono text-xs text-info">
                                ↓{entry.repo.sync?.behind}
                              </span>
                            {:else if entry.task?.status === 'updated'}
                              <span class="font-mono text-xs text-success">
                                +{entry.task.count}
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
