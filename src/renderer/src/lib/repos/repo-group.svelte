<script lang="ts">
  import IconCloudDownload from '@tabler/icons-svelte/icons/cloud-download'
  import IconFolder from '@tabler/icons-svelte/icons/folder'
  import IconFolderOpen from '@tabler/icons-svelte/icons/folder-open'
  import IconRefresh from '@tabler/icons-svelte/icons/refresh'
  import { SvelteSet } from 'svelte/reactivity'
  import * as Collapsible from '$lib/components/ui/collapsible'
  import * as Sidebar from '$lib/components/ui/sidebar'
  import SidebarSection from '$lib/components/sidebar-section.svelte'
  import StatusDot from '$lib/components/status-dot.svelte'
  import ToolbarButton from '$lib/components/toolbar-button.svelte'
  import { dirOf, nameOf } from '$lib/paths'
  import { behind, statusOf, type Workspace } from '$lib/repos/workspace.svelte'

  let {
    workspace,
    selected,
    onselect
  }: {
    workspace: Workspace
    selected: string | undefined
    onselect: (path: string) => void
  } = $props()

  const expanded = new SvelteSet<string>()

  const folders = $derived(
    [
      ...Map.groupBy(
        workspace.entries.toSorted((a, b) => a.repo.path.localeCompare(b.repo.path)),
        (entry) => dirOf(entry.repo.path)
      )
    ].toSorted(([a], [b]) => a.localeCompare(b))
  )

  function setExpanded(dir: string, open: boolean): void {
    if (open) expanded.add(dir)
    else expanded.delete(dir)
  }
</script>

<SidebarSection label="Repositories">
  {#snippet toolbar()}
    <ToolbarButton
      label="Refresh"
      icon={IconRefresh}
      busy={workspace.checking}
      disabled={workspace.busy}
      onclick={() => workspace.refresh()}
    />
    <ToolbarButton
      label="Pull {workspace.outdated.length} outdated"
      icon={IconCloudDownload}
      busy={workspace.pulling}
      disabled={workspace.busy || workspace.outdated.length === 0}
      onclick={() => workspace.pullAll()}
    />
  {/snippet}
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
                    <IconFolderOpen stroke={1.5} />
                  {:else}
                    <IconFolder stroke={1.5} />
                  {/if}
                  <span class="flex-1 truncate-fade">{workspace.relative(dir)}</span>
                  {#if !open}
                    {@const outdated = entries.filter(behind).length}
                    {#if outdated > 0}
                      <span class="text-xs">{outdated} outdated</span>
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
                      onclick={() => onselect(entry.repo.path)}
                    >
                      <StatusDot {status} />
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
</SidebarSection>
