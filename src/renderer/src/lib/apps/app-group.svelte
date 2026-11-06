<script lang="ts">
  import IconCloudDownload from '@tabler/icons-svelte/icons/cloud-download'
  import IconRefresh from '@tabler/icons-svelte/icons/refresh'
  import SidebarSection from '$lib/components/sidebar-section.svelte'
  import StatusDot from '$lib/components/status-dot.svelte'
  import ToolbarButton from '$lib/components/toolbar-button.svelte'
  import * as Sidebar from '$lib/components/ui/sidebar'
  import { statusOf, type Apps } from '$lib/apps/apps.svelte'

  let { apps, selected = $bindable() }: { apps: Apps; selected: string | undefined } = $props()
</script>

<SidebarSection label="Applications">
  {#snippet toolbar()}
    <ToolbarButton
      label="Check for updates"
      icon={IconRefresh}
      busy={apps.activity === 'scan' || apps.activity === 'check'}
      disabled={apps.busy}
      onclick={() => apps.refresh()}
    />
    <ToolbarButton
      label="Update {apps.outdated.length} outdated"
      icon={IconCloudDownload}
      busy={apps.activity === 'update'}
      disabled={apps.busy || apps.outdated.length === 0}
      onclick={() => apps.update(apps.outdated)}
    />
  {/snippet}
  <Sidebar.Menu class="pt-1">
    {#each apps.entries as entry (entry.app.path)}
      {@const { app } = entry}
      <Sidebar.MenuItem>
        <Sidebar.MenuButton
          size="sm"
          isActive={app.path === selected}
          onclick={() => (selected = app.path)}
        >
          <StatusDot status={statusOf(entry)} />
          <img src={app.icon} alt="" class="size-4 shrink-0" />
          <span class="flex-1 truncate-fade">{app.name}</span>
        </Sidebar.MenuButton>
      </Sidebar.MenuItem>
    {/each}
  </Sidebar.Menu>
</SidebarSection>
