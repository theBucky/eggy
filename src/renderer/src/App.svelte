<script lang="ts">
  import IconHome from '@tabler/icons-svelte/icons/home'
  import IconSettings from '@tabler/icons-svelte/icons/settings'
  import AppDetail from '$lib/apps/app-detail.svelte'
  import AppGroup from '$lib/apps/app-group.svelte'
  import { Apps } from '$lib/apps/apps.svelte'
  import QuitDialog from '$lib/apps/quit-dialog.svelte'
  import * as Sidebar from '$lib/components/ui/sidebar'
  import Home from '$lib/home/home.svelte'
  import RepoDetail from '$lib/repos/repo-detail.svelte'
  import RepoGroup from '$lib/repos/repo-group.svelte'
  import { Workspace } from '$lib/repos/workspace.svelte'
  import { Preferences } from '$lib/settings/preferences.svelte'
  import Settings from '$lib/settings/settings.svelte'

  type View = { page: 'home' | 'settings' } | { page: 'detail'; path: string }

  const workspace = new Workspace()
  const apps = new Apps()
  const preferences = new Preferences()

  let view = $state<View>({ page: 'home' })

  const selected = $derived(view.page === 'detail' ? view.path : undefined)
  const repo = $derived(workspace.entries.find((entry) => entry.repo.path === selected))
  const app = $derived(apps.entries.find((entry) => entry.app.path === selected))
  const home = $derived(view.page !== 'settings' && repo === undefined && app === undefined)
  const pending = $derived(apps.outdated.length + workspace.outdated.length)

  if (preferences.checkOnLaunch) {
    workspace.refresh()
    apps.refresh()
  } else {
    workspace.scan()
    apps.scan()
  }
</script>

<!-- Listed first so the no-drag controls below carve themselves out of it. -->
<div class="fixed inset-x-0 top-0 h-10 [-webkit-app-region:drag]"></div>

<Sidebar.Provider style="--sidebar-width: 18rem">
  <Sidebar.Root variant="inset">
    <div class="px-1 pt-12 pb-2">
      <Sidebar.Menu>
        <Sidebar.MenuItem>
          <Sidebar.MenuButton size="sm" isActive={home} onclick={() => (view = { page: 'home' })}>
            <IconHome stroke={1.5} />
            <span class="flex-1 truncate-fade">Home</span>
            {#if pending > 0}
              <span class="font-mono text-xs text-info">{pending}</span>
            {/if}
          </Sidebar.MenuButton>
        </Sidebar.MenuItem>
      </Sidebar.Menu>
    </div>

    <Sidebar.Content class="scroll-fade-y">
      <AppGroup {apps} {selected} onselect={(path) => (view = { page: 'detail', path })} />
      <RepoGroup {workspace} {selected} onselect={(path) => (view = { page: 'detail', path })} />
    </Sidebar.Content>

    <div class="px-1 py-2">
      <Sidebar.Menu>
        <Sidebar.MenuItem>
          <Sidebar.MenuButton
            size="sm"
            isActive={view.page === 'settings'}
            onclick={() => (view = { page: 'settings' })}
          >
            <IconSettings stroke={1.5} />
            <span class="flex-1 truncate-fade">Settings</span>
          </Sidebar.MenuButton>
        </Sidebar.MenuItem>
      </Sidebar.Menu>
    </div>
  </Sidebar.Root>

  <Sidebar.Inset>
    {#if view.page === 'settings'}
      <Settings {workspace} {preferences} />
    {:else if repo}
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
