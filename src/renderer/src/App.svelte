<script lang="ts">
  import * as Sidebar from '$lib/components/ui/sidebar'
  import RepoDetail from '$lib/repos/repo-detail.svelte'
  import RepoGroup from '$lib/repos/repo-group.svelte'
  import RepoOverview from '$lib/repos/repo-overview.svelte'
  import { Workspace } from '$lib/repos/workspace.svelte'

  const workspace = new Workspace()
  let selected = $state<string>()

  const current = $derived(workspace.entries.find((entry) => entry.repo.path === selected))

  workspace.scan()
</script>

<!-- Listed first so the no-drag controls below carve themselves out of it. -->
<div class="fixed inset-x-0 top-0 h-10 [-webkit-app-region:drag]"></div>

<Sidebar.Provider style="--sidebar-width: 18rem">
  <Sidebar.Root variant="inset">
    <!-- Keeps the sidebar content clear of the traffic lights. -->
    <div class="h-8 shrink-0"></div>

    <Sidebar.Content class="scroll-fade-y">
      <RepoGroup {workspace} bind:selected />
    </Sidebar.Content>
  </Sidebar.Root>

  <Sidebar.Inset>
    {#if current}
      <!-- Keyed so switching repos starts each scroller at the top with unpushed commits folded. -->
      {#key current.repo.path}
        <RepoDetail {workspace} entry={current} />
      {/key}
    {:else}
      <RepoOverview {workspace} />
    {/if}
  </Sidebar.Inset>
</Sidebar.Provider>
