<script lang="ts">
  import FailureText from '$lib/components/failure-text.svelte'
  import ListCard from '$lib/components/list-card.svelte'
  import StandingNote from '$lib/components/standing-note.svelte'
  import * as Item from '$lib/components/ui/item'
  import { failureOf, labelOf, releaseOf, type Apps, type Entry } from '$lib/apps/apps.svelte'
  import UpgradeButton from '$lib/apps/upgrade-button.svelte'
  import { clauses, megabytes } from '$lib/format'
  import type { App, Release } from '$shared/apps'

  let { apps, onselect }: { apps: Apps; onselect: (id: string) => void } = $props()

  const rows = $derived(apps.entries.filter((entry) => releaseOf(entry) || failureOf(entry)))

  function metaOf(app: App, release: Release): string {
    const bump =
      app.version === release.version
        ? `${labelOf(app)} → ${labelOf(release)}`
        : `${app.version} → ${release.version}`

    return clauses(bump, release.size !== undefined && megabytes(release.size))
  }
</script>

<ListCard title="Applications">
  {#each rows as entry, index (entry.id)}
    {#if index > 0}<Item.Separator decorative />{/if}
    {@render row(entry)}
  {:else}
    <StandingNote source={apps} empty="No applications." />
  {/each}
</ListCard>

{#snippet row(entry: Entry)}
  {@const { app } = entry}
  {@const release = releaseOf(entry)}
  {@const failed = failureOf(entry)}
  <Item.Root size="xs" role="listitem">
    <Item.Media variant="image"><img src={app.icon} alt="" /></Item.Media>
    <Item.Content>
      <Item.Title>
        <button type="button" class="stretched truncate" onclick={() => onselect(entry.id)}>
          {app.name}
        </button>
      </Item.Title>
      <Item.Description>
        {#if failed}
          <FailureText message={failed.message} />
        {:else if release}
          <span class="font-mono">{metaOf(app, release)}</span>
        {/if}
      </Item.Description>
    </Item.Content>
    {#if release}
      <Item.Actions class="relative"><UpgradeButton {apps} {entry} /></Item.Actions>
    {/if}
  </Item.Root>
{/snippet}
