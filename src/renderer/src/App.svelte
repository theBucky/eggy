<script lang="ts">
  import IconGauge from '@tabler/icons-svelte/icons/gauge'
  import IconHome from '@tabler/icons-svelte/icons/home'
  import IconSettings from '@tabler/icons-svelte/icons/settings'
  import type { Snippet } from 'svelte'
  import AppDetail from '$lib/apps/app-detail.svelte'
  import AppGroup from '$lib/apps/app-group.svelte'
  import QuitDialog from '$lib/apps/quit-dialog.svelte'
  import * as Sidebar from '$lib/components/ui/sidebar'
  import { Spinner } from '$lib/components/ui/spinner'
  import Home from '$lib/home/home.svelte'
  import Optimize from '$lib/optimize/optimize.svelte'
  import { Optimizer } from '$lib/optimize/optimizer.svelte'
  import PackageDetail from '$lib/packages/package-detail.svelte'
  import PackageGroup from '$lib/packages/package-group.svelte'
  import RepoDetail from '$lib/repos/repo-detail.svelte'
  import RepoGroup from '$lib/repos/repo-group.svelte'
  import { Preferences } from '$lib/settings/preferences.svelte'
  import Settings from '$lib/settings/settings.svelte'
  import { Sources } from '$lib/sources.svelte'
  import type { Detail, View } from '$lib/view'

  const sources = new Sources()
  const { apps, packages, repos } = sources
  const optimizer = new Optimizer()
  const preferences = new Preferences()

  let view = $state<View>({ page: 'home' })

  const app = $derived(view.page === 'app' ? apps.find(view.id) : undefined)
  const pkg = $derived(view.page === 'package' ? packages.find(view.id) : undefined)
  const repo = $derived(view.page === 'repo' ? repos.find(view.id) : undefined)
  const page = $derived('id' in view && !app && !pkg && !repo ? 'home' : view.page)

  if (preferences.checkOnLaunch) sources.refresh()
  else sources.scan()

  window.api.on('menuCommand', (command) => {
    if (command === 'settings') view = { page: 'settings' }
    else if (!sources.busy) sources.refresh()
  })
</script>

<!-- Listed first so the no-drag controls below carve themselves out of it. -->
<div class="fixed inset-x-0 top-0 h-10 [-webkit-app-region:drag]"></div>

<Sidebar.Provider style="--sidebar-width: 18rem">
  <Sidebar.Root variant="inset">
    <div class="px-1 pt-12 pb-2">
      <Sidebar.Menu>
        {@render nav('home', IconHome, 'Home', outdated)}
        {@render nav('optimize', IconGauge, 'Optimize', optimizing)}
      </Sidebar.Menu>
    </div>

    <Sidebar.Content class="overflow-fade-y">
      <AppGroup {apps} selected={app?.id} onselect={(id) => (view = { page: 'app', id })} />
      {#if packages.installed}
        <PackageGroup
          {packages}
          selected={pkg?.id}
          onselect={(id) => (view = { page: 'package', id })}
        />
      {/if}
      <RepoGroup {repos} selected={repo?.id} onselect={(id) => (view = { page: 'repo', id })} />
    </Sidebar.Content>

    <div class="px-1 py-2">
      <Sidebar.Menu>
        {@render nav('settings', IconSettings, 'Settings')}
      </Sidebar.Menu>
    </div>
  </Sidebar.Root>

  <Sidebar.Inset>
    {#if page === 'settings'}
      <Settings {repos} {preferences} />
    {:else if page === 'optimize'}
      <Optimize {optimizer} />
    {:else if repo}
      {#key repo.id}
        <RepoDetail {repos} entry={repo} />
      {/key}
    {:else if app}
      {#key app.id}
        <AppDetail {apps} entry={app} />
      {/key}
    {:else if pkg}
      {#key pkg.id}
        <PackageDetail {packages} entry={pkg} />
      {/key}
    {:else}
      <Home {sources} onselect={(detail) => (view = detail)} />
    {/if}
  </Sidebar.Inset>
</Sidebar.Provider>

<QuitDialog prompt={apps.prompt} />

{#snippet nav(
  target: Exclude<View['page'], Detail['page']>,
  Icon: typeof IconHome,
  label: string,
  trailing?: Snippet
)}
  <Sidebar.MenuItem>
    <Sidebar.MenuButton isActive={page === target} onclick={() => (view = { page: target })}>
      <Icon />
      <span class="flex-1 truncate-fade">{label}</span>
      {@render trailing?.()}
    </Sidebar.MenuButton>
  </Sidebar.MenuItem>
{/snippet}

{#snippet outdated()}
  {#if sources.outdated > 0}
    <span class="font-mono text-xs text-info">{sources.outdated}</span>
  {/if}
{/snippet}

{#snippet optimizing()}
  {#if optimizer.running}
    <Spinner />
  {/if}
{/snippet}
