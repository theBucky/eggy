<script lang="ts">
  import AppDetail from '$lib/apps/app-detail.svelte'
  import AppGroup from '$lib/apps/app-group.svelte'
  import { Apps } from '$lib/apps/apps.svelte'
  import QuitDialog from '$lib/apps/quit-dialog.svelte'
  import * as Sidebar from '$lib/components/ui/sidebar'
  import RepoDetail from '$lib/repos/repo-detail.svelte'
  import RepoGroup from '$lib/repos/repo-group.svelte'
  import RepoOverview from '$lib/repos/repo-overview.svelte'
  import { Workspace } from '$lib/repos/workspace.svelte'

  const workspace = new Workspace()
  const apps = new Apps()

  // Repos and apps never share a path.
  let selected = $state<string>()

  const repo = $derived(workspace.entries.find((entry) => entry.repo.path === selected))
  const app = $derived(apps.entries.find((entry) => entry.app.path === selected))

  workspace.scan()

  apps.scan()
</script>

<!-- Listed first so the no-drag controls below carve themselves out of it. -->
<div class="fixed inset-x-0 top-0 h-10 [-webkit-app-region:drag]"></div>

<Sidebar.Provider style="--sidebar-width: 18rem">
  <Sidebar.Root variant="inset">
    <!-- Keeps the sidebar content clear of the traffic lights. -->
    <div class="h-8 shrink-0"></div>

    <Sidebar.Content class="scroll-fade-y">
      <AppGroup {apps} bind:selected />
      <RepoGroup {workspace} bind:selected />
    </Sidebar.Content>
  </Sidebar.Root>

  <Sidebar.Inset>
    {#if repo}
      <!-- Keyed so switching repos starts each scroller at the top with unpushed commits folded. -->
      {#key repo.repo.path}
        <RepoDetail {workspace} entry={repo} />
      {/key}
    {:else if app}
      {#key app.app.path}
        <AppDetail {apps} entry={app} />
      {/key}
    {:else}
      <RepoOverview {workspace} />
    {/if}
  </Sidebar.Inset>
</Sidebar.Provider>

<QuitDialog {apps} />
