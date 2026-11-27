<script lang="ts">
  import * as Sidebar from '$primitives/ui/sidebar'
  import SidebarSection from '$source/sidebar-section.svelte'
  import StatusDot from '$source/status-dot.svelte'
  import type { Packages } from './packages.svelte'

  let {
    packages,
    selected,
    onselect
  }: { packages: Packages; selected: string | undefined; onselect: (id: string) => void } = $props()

  const shown = $derived(
    packages.entries.filter(
      ({ package: pkg, task }) => pkg.requested || pkg.state === 'outdated' || task !== undefined
    )
  )
</script>

<SidebarSection
  label="Packages"
  source={packages}
  checkLabel="Check for upgrades"
  upgradeVerb="Upgrade"
>
  <Sidebar.Menu>
    {#each shown as entry (entry.id)}
      <Sidebar.MenuItem>
        <Sidebar.MenuButton isActive={entry.id === selected} onclick={() => onselect(entry.id)}>
          <StatusDot status={packages.statusOf(entry)} />
          <span class="flex-1 truncate-fade">{entry.package.name}</span>
        </Sidebar.MenuButton>
      </Sidebar.MenuItem>
    {/each}
  </Sidebar.Menu>
</SidebarSection>
