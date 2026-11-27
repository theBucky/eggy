<script lang="ts">
  import FailureText from '$primitives/failure-text.svelte'
  import { clauses } from '$primitives/format'
  import ListCard from '$primitives/list-card.svelte'
  import ListNote from '$primitives/list-note.svelte'
  import * as Item from '$primitives/ui/item'
  import StandingNote from '$source/standing-note.svelte'
  import type { Entry, Packages } from './packages.svelte'
  import UpgradeButton from './upgrade-button.svelte'

  let { packages }: { packages: Packages } = $props()
</script>

<ListCard title="Packages">
  {#each packages.outdated as entry, index (entry.id)}
    {#if index > 0}<Item.Separator decorative />{/if}
    {@render row(entry)}
  {/each}
  {#if packages.listing?.status === 'failed'}
    {#if packages.outdated.length > 0}<Item.Separator decorative />{/if}
    <ListNote><FailureText message={packages.listing.message} /></ListNote>
  {:else if packages.outdated.length === 0}
    <StandingNote source={packages} empty="No packages." />
  {/if}
</ListCard>

{#snippet row(entry: Entry)}
  {@const { package: pkg, task } = entry}
  <Item.Root size="xs" role="listitem">
    <Item.Content>
      <Item.Title><span class="line-clamp-1">{pkg.name}</span></Item.Title>
      <Item.Description>
        {#if task?.status === 'failed'}
          <FailureText message={task.message} />
        {:else}
          <span class="font-mono">
            {clauses(`${pkg.version} → ${pkg.latest}`, !pkg.requested && 'dependency')}
          </span>
        {/if}
      </Item.Description>
    </Item.Content>
    <Item.Actions><UpgradeButton {packages} {entry} /></Item.Actions>
  </Item.Root>
{/snippet}
