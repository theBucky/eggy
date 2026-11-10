<script lang="ts">
  import IconGauge from '@tabler/icons-svelte/icons/gauge'
  import IconHome from '@tabler/icons-svelte/icons/home'
  import IconSettings from '@tabler/icons-svelte/icons/settings'
  import AppDetail from '$lib/apps/app-detail.svelte'
  import AppGroup from '$lib/apps/app-group.svelte'
  import { Apps } from '$lib/apps/apps.svelte'
  import QuitDialog from '$lib/apps/quit-dialog.svelte'
  import * as Sidebar from '$lib/components/ui/sidebar'
  import { Spinner } from '$lib/components/ui/spinner'
  import Home from '$lib/home/home.svelte'
  import Optimize from '$lib/optimize/optimize.svelte'
  import { Optimizer } from '$lib/optimize/optimizer.svelte'
  import PackageDetail from '$lib/packages/package-detail.svelte'
  import PackageGroup from '$lib/packages/package-group.svelte'
  import { idOf, Packages } from '$lib/packages/packages.svelte'
  import RepoDetail from '$lib/repos/repo-detail.svelte'
  import RepoGroup from '$lib/repos/repo-group.svelte'
  import { Repos } from '$lib/repos/repos.svelte'
  import { Preferences } from '$lib/settings/preferences.svelte'
  import Settings from '$lib/settings/settings.svelte'
  import { Sources } from '$lib/sources.svelte'

  type View = { page: 'home' | 'optimize' | 'settings' } | { page: 'detail'; id: string }

  const repos = new Repos()
  const apps = new Apps()
  const packages = new Packages()
  const sources = new Sources([apps, packages, repos])
  const optimizer = new Optimizer()
  const preferences = new Preferences()

  let view = $state<View>({ page: 'home' })

  const selected = $derived(view.page === 'detail' ? view.id : undefined)
  const repo = $derived(repos.entries.find((entry) => entry.repo.path === selected))
  const app = $derived(apps.entries.find((entry) => entry.app.path === selected))
  const pkg = $derived(packages.entries.find((entry) => idOf(entry.package) === selected))

  const home = $derived(
    view.page === 'home' ||
      (view.page === 'detail' && repo === undefined && app === undefined && pkg === undefined)
  )

  if (preferences.checkOnLaunch) sources.refresh()
  else sources.scan()
</script>

<!-- Listed first so the no-drag controls below carve themselves out of it. -->
<div class="fixed inset-x-0 top-0 h-10 [-webkit-app-region:drag]"></div>

<Sidebar.Provider style="--sidebar-width: 18rem">
  <Sidebar.Root variant="inset">
    <div class="px-1 pt-12 pb-2">
      <Sidebar.Menu>
        <Sidebar.MenuItem>
          <Sidebar.MenuButton size="sm" isActive={home} onclick={() => (view = { page: 'home' })}>
            <IconHome />
            <span class="flex-1 truncate-fade">Home</span>
            {#if sources.outdated.length > 0}
              <span class="font-mono text-xs text-info">{sources.outdated.length}</span>
            {/if}
          </Sidebar.MenuButton>
        </Sidebar.MenuItem>
        <Sidebar.MenuItem>
          <Sidebar.MenuButton
            size="sm"
            isActive={view.page === 'optimize'}
            onclick={() => (view = { page: 'optimize' })}
          >
            <IconGauge />
            <span class="flex-1 truncate-fade">Optimize</span>
            {#if optimizer.running}
              <Spinner />
            {/if}
          </Sidebar.MenuButton>
        </Sidebar.MenuItem>
      </Sidebar.Menu>
    </div>

    <Sidebar.Content class="scroll-fade-y">
      <AppGroup {apps} {selected} onselect={(id) => (view = { page: 'detail', id })} />
      {#if packages.installed}
        <PackageGroup {packages} {selected} onselect={(id) => (view = { page: 'detail', id })} />
      {/if}
      <RepoGroup {repos} {selected} onselect={(id) => (view = { page: 'detail', id })} />
    </Sidebar.Content>

    <div class="px-1 py-2">
      <Sidebar.Menu>
        <Sidebar.MenuItem>
          <Sidebar.MenuButton
            size="sm"
            isActive={view.page === 'settings'}
            onclick={() => (view = { page: 'settings' })}
          >
            <IconSettings />
            <span class="flex-1 truncate-fade">Settings</span>
          </Sidebar.MenuButton>
        </Sidebar.MenuItem>
      </Sidebar.Menu>
    </div>
  </Sidebar.Root>

  <Sidebar.Inset>
    {#if view.page === 'settings'}
      <Settings {repos} {preferences} />
    {:else if view.page === 'optimize'}
      <Optimize {optimizer} />
    {:else if repo}
      {#key repo.repo.path}
        <RepoDetail {repos} entry={repo} />
      {/key}
    {:else if app}
      {#key app.app.path}
        <AppDetail {apps} entry={app} />
      {/key}
    {:else if pkg}
      {#key idOf(pkg.package)}
        <PackageDetail {packages} entry={pkg} />
      {/key}
    {:else}
      <Home {apps} {packages} {repos} {sources} />
    {/if}
  </Sidebar.Inset>
</Sidebar.Provider>

<QuitDialog {apps} />
