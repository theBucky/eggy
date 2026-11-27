<script lang="ts">
  import IconChevronDown from '@tabler/icons-svelte/icons/chevron-down'
  import IconChevronUp from '@tabler/icons-svelte/icons/chevron-up'
  import { nameOf, tilde } from '$client/paths'
  import FailureAlert from '$primitives/failure-alert.svelte'
  import { ago } from '$primitives/format'
  import MetaList from '$primitives/meta-list.svelte'
  import Page from '$primitives/page.svelte'
  import Section from '$primitives/section.svelte'
  import { Badge } from '$primitives/ui/badge'
  import { Button } from '$primitives/ui/button'
  import * as Item from '$primitives/ui/item'
  import type { Commit } from '$shared/repos'
  import type { StatusBadge } from '$source/status'
  import CommitDiff from './commit-diff.svelte'
  import PullButton from './pull-button.svelte'
  import { diverged, offsetsOf, type Entry, type Repos } from './repos.svelte'
  import SidePane from './side-pane.svelte'

  let { repos, entry }: { repos: Repos; entry: Entry } = $props()

  const { repo, task } = $derived(entry)
  const { unpushed, pushed } = $derived(repo.history)

  let showUnpushed = $state(false)
  let selected = $state<Commit>()

  const aheadLabel = $derived(
    `${unpushed.length}${(repo.sync?.ahead ?? 0) > unpushed.length ? '+' : ''} ahead`
  )

  const badge = $derived.by((): StatusBadge => {
    if (task?.command === 'fetch' && task.status === 'running') {
      return { label: 'Checking', variant: 'secondary' }
    }

    if (repo.sync === undefined) return { label: 'Gone', variant: 'destructive' }

    const { ahead, behind } = repo.sync

    if (ahead === 0 && behind === 0) return { label: 'Up to date', variant: 'success' }

    return { label: offsetsOf(repo.sync), variant: behind > 0 ? 'info' : 'secondary' }
  })
</script>

<SidePane item={selected}>
  <Page title={nameOf(repo.path)}>
    {#snippet subtitle()}
      <p class="truncate font-mono text-xs text-muted-foreground select-text">{tilde(repo.path)}</p>
    {/snippet}

    {#snippet actions()}
      {#if diverged(entry)}
        <PullButton {repos} {entry} command="rebase" variant="destructive-secondary" />
      {/if}
      <PullButton {repos} {entry} command="pull" variant="primary" />
    {/snippet}

    <MetaList>
      <dt>Branch</dt>
      <dd class="truncate font-mono text-xs select-text">{repo.branch}</dd>
      <dt>Upstream</dt>
      <dd class="flex min-w-0 items-center gap-2">
        <span class="truncate font-mono text-xs select-text">{repo.upstream}</span>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </dd>
      <dt>Remote</dt>
      <dd class="truncate font-mono text-xs select-text">{repo.remote}</dd>
    </MetaList>

    {#if task?.status === 'failed'}
      <FailureAlert
        title={task.command === 'fetch' ? 'Fetch failed' : 'Pull failed'}
        message={task.message}
      />
    {/if}

    {#if unpushed.length > 0 || pushed.length > 0}
      <Section title="Recent commits" actions={unpushed.length > 0 ? ahead : undefined}>
        <div class="scroll-section">
          <Item.Group>
            {#if showUnpushed}
              {#each unpushed as commit (commit.hash)}
                {@render row(commit, false)}
              {/each}
            {/if}
            {#each pushed as commit (commit.hash)}
              {@render row(commit, true)}
            {/each}
          </Item.Group>
        </div>
      </Section>
    {/if}
  </Page>

  {#snippet pane(commit, revealed)}
    <CommitDiff path={repo.path} {commit} {revealed} onclose={() => (selected = undefined)} />
  {/snippet}
</SidePane>

{#snippet ahead()}
  <Button
    variant="ghost"
    aria-expanded={showUnpushed}
    onclick={() => (showUnpushed = !showUnpushed)}
  >
    {aheadLabel}
    {#if showUnpushed}
      <IconChevronUp data-icon="inline-end" />
    {:else}
      <IconChevronDown data-icon="inline-end" />
    {/if}
  </Button>
{/snippet}

{#snippet row(commit: Commit, published: boolean)}
  {@const active = commit.hash === selected?.hash}
  <div role="listitem" class={[!published && 'opacity-50']}>
    <Item.Root size="xs">
      {#snippet child({ props })}
        <button
          {...props}
          type="button"
          aria-pressed={active}
          onclick={() => (selected = active ? undefined : commit)}
        >
          <Item.Content>
            <Item.Title>
              <Badge variant="secondary">
                <span class="font-mono">{commit.hash}</span>
              </Badge>
              <span class="line-clamp-1 text-left wrap-anywhere">{commit.subject}</span>
            </Item.Title>
            <Item.Description>
              <span class="line-clamp-1 wrap-anywhere">
                {commit.author}, {ago(commit.date)}
              </span>
            </Item.Description>
          </Item.Content>
        </button>
      {/snippet}
    </Item.Root>
  </div>
{/snippet}
