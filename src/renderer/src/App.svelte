<script lang="ts">
  import IconHome from '@tabler/icons-svelte/icons/home'
  import AppDetail from '$lib/apps/app-detail.svelte'
  import AppGroup from '$lib/apps/app-group.svelte'
  import { Apps } from '$lib/apps/apps.svelte'
  import QuitDialog from '$lib/apps/quit-dialog.svelte'
  import * as Sidebar from '$lib/components/ui/sidebar'
  import Home from '$lib/home/home.svelte'
  import RepoDetail from '$lib/repos/repo-detail.svelte'
  import RepoGroup from '$lib/repos/repo-group.svelte'
  import { Workspace } from '$lib/repos/workspace.svelte'

  const workspace = new Workspace()
  const apps = new Apps()

  let selected = $state<string>()

  const repo = $derived(workspace.entries.find((entry) => entry.repo.path === selected))
  const app = $derived(apps.entries.find((entry) => entry.app.path === selected))
  const pending = $derived(apps.outdated.length + workspace.outdated.length)

  workspace.scan()

  apps.scan()
</script>

<!-- Listed first so the no-drag controls below carve themselves out of it. -->
<div class="fixed inset-x-0 top-0 h-10 [-webkit-app-region:drag]"></div>

<Sidebar.Provider style="--sidebar-width: 18rem">
  <Sidebar.Root variant="inset">
    <div class="shrink-0 px-1 pt-12 pb-2">
      <Sidebar.Menu>
        <Sidebar.MenuItem>
          <Sidebar.MenuButton
            size="sm"
            isActive={repo === undefined && app === undefined}
            onclick={() => (selected = undefined)}
          >
            <IconHome stroke={1.5} class="text-muted-foreground" />
            <span class="flex-1 truncate-fade">Home</span>
            {#if pending > 0}
              <span class="font-mono text-xs text-info">{pending}</span>
            {/if}
          </Sidebar.MenuButton>
        </Sidebar.MenuItem>
      </Sidebar.Menu>
    </div>

    <Sidebar.Content class="scroll-fade-y">
      <AppGroup {apps} bind:selected />
      <RepoGroup {workspace} bind:selected />
    </Sidebar.Content>
  </Sidebar.Root>

  <Sidebar.Inset>
    {#if repo}
      {#key repo.repo.path}
        <RepoDetail {workspace} entry={repo} />
      {/key}
    {:else if app}
      {#key app.app.path}
        <AppDetail {apps} entry={app} />
      {/key}
    {:else}
      <Home {apps} {workspace} {pending} />
    {/if}
  </Sidebar.Inset>
</Sidebar.Provider>

<QuitDialog {apps} />
