<script lang="ts">
  import SidebarSection from '$lib/components/sidebar-section.svelte'
  import StatusDot from '$lib/components/status-dot.svelte'
  import * as Sidebar from '$lib/components/ui/sidebar'
  import { statusOf, type Apps } from '$lib/apps/apps.svelte'

  let {
    apps,
    selected,
    onselect
  }: { apps: Apps; selected: string | undefined; onselect: (path: string) => void } = $props()
</script>

<SidebarSection
  label="Applications"
  source={apps}
  checkLabel="Check for upgrades"
  upgradeVerb="Upgrade"
>
  <Sidebar.Menu>
    {#each apps.entries as entry (entry.app.path)}
      {@const { app } = entry}
      <Sidebar.MenuItem>
        <Sidebar.MenuButton
          size="sm"
          isActive={app.path === selected}
          onclick={() => onselect(app.path)}
        >
          <StatusDot status={statusOf(entry)} />
          <img src={app.icon} alt="" class="size-4 shrink-0" />
          <span class="flex-1 truncate-fade">{app.name}</span>
        </Sidebar.MenuButton>
      </Sidebar.MenuItem>
    {/each}
  </Sidebar.Menu>
</SidebarSection>
