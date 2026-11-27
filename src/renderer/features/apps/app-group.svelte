<script lang="ts">
  import * as Sidebar from '$primitives/ui/sidebar'
  import SidebarSection from '$source/sidebar-section.svelte'
  import StatusDot from '$source/status-dot.svelte'
  import type { Apps } from './apps.svelte'

  let {
    apps,
    selected,
    onselect
  }: { apps: Apps; selected: string | undefined; onselect: (id: string) => void } = $props()
</script>

<SidebarSection
  label="Applications"
  source={apps}
  checkLabel="Check for upgrades"
  upgradeVerb="Upgrade"
>
  <Sidebar.Menu>
    {#each apps.entries as entry (entry.id)}
      {@const { app } = entry}
      <Sidebar.MenuItem>
        <Sidebar.MenuButton isActive={entry.id === selected} onclick={() => onselect(entry.id)}>
          <StatusDot status={apps.statusOf(entry)} />
          <img src={app.icon} alt="" class="size-4 shrink-0" />
          <span class="flex-1 truncate-fade">{app.name}</span>
        </Sidebar.MenuButton>
      </Sidebar.MenuItem>
    {/each}
  </Sidebar.Menu>
</SidebarSection>
