<script lang="ts">
  import { nameOf, tilde } from '$client/paths'
  import FailureText from '$primitives/failure-text.svelte'
  import ListCard from '$primitives/list-card.svelte'
  import { Badge } from '$primitives/ui/badge'
  import * as Item from '$primitives/ui/item'
  import StandingNote from '$source/standing-note.svelte'
  import PullButton from './pull-button.svelte'
  import { behind, diverged, offsetsOf, pendingPull, type Entry, type Repos } from './repos.svelte'

  let { repos, onselect }: { repos: Repos; onselect: (id: string) => void } = $props()

  const rows = $derived(
    repos.entries.filter(
      (entry) => behind(entry) || entry.task?.status === 'failed' || pendingPull(entry)
    )
  )
</script>

<ListCard title="Repositories">
  {#each rows as entry, index (entry.id)}
    {#if index > 0}<Item.Separator decorative />{/if}
    {@render row(entry)}
  {:else}
    <StandingNote
      source={repos}
      empty={`Nothing under ${tilde(repos.root)} tracks an upstream branch.`}
    />
  {/each}
</ListCard>

{#snippet row(entry: Entry)}
  {@const { repo, task } = entry}
  {@const pull = pendingPull(entry)}
  {@const offsets = repo.sync && offsetsOf(repo.sync)}
  <Item.Root size="xs" role="listitem">
    <Item.Content>
      <Item.Title>
        <button type="button" class="stretched shrink-0" onclick={() => onselect(entry.id)}>
          {nameOf(repo.path)}
        </button>
        <Badge variant="secondary">{repo.branch}</Badge>
        {#if task?.status === 'failed'}
          <Item.Description><FailureText message={task.message} /></Item.Description>
        {:else if offsets}
          <Badge variant="info">{offsets}</Badge>
        {/if}
      </Item.Title>
    </Item.Content>
    {#if behind(entry) || pull}
      <Item.Actions class="relative">
        <PullButton {repos} {entry} command={pull ?? (diverged(entry) ? 'rebase' : 'pull')} />
      </Item.Actions>
    {/if}
  </Item.Root>
{/snippet}
