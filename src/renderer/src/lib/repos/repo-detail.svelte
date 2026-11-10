<script lang="ts">
  import IconChevronDown from '@tabler/icons-svelte/icons/chevron-down'
  import IconChevronUp from '@tabler/icons-svelte/icons/chevron-up'
  import FailureAlert from '$lib/components/failure-alert.svelte'
  import Page from '$lib/components/page.svelte'
  import SidePane from '$lib/components/side-pane.svelte'
  import { Badge, type BadgeVariant } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import * as Item from '$lib/components/ui/item'
  import { nameOf, tilde } from '$lib/paths'
  import { ago } from '$lib/format'
  import CommitDiff from '$lib/repos/commit-diff.svelte'
  import PullButton from '$lib/repos/pull-button.svelte'
  import { diverged, type Entry, type Repos } from '$lib/repos/repos.svelte'
  import type { Commit } from '$shared/api'

  type SyncBadge = { label: string; variant: BadgeVariant }

  let { repos, entry }: { repos: Repos; entry: Entry } = $props()

  const { repo, task } = $derived(entry)
  const { unpushed, pushed } = $derived(repo.history)

  let showUnpushed = $state(false)
  let selected = $state<Commit>()

  const aheadLabel = $derived(
    `${unpushed.length}${(repo.sync?.ahead ?? 0) > unpushed.length ? '+' : ''} ahead`
  )

  const badge = $derived.by((): SyncBadge => {
    if (task?.command === 'fetch' && task.status === 'running') {
      return { label: 'Checking', variant: 'secondary' }
    }

    if (repo.sync === undefined) return { label: 'Gone', variant: 'destructive' }

    const { ahead, behind } = repo.sync

    if (ahead === 0 && behind === 0) return { label: 'Up to date', variant: 'success' }

    return {
      label: [ahead > 0 && `${ahead} ahead`, behind > 0 && `${behind} behind`]
        .filter(Boolean)
        .join(', '),
      variant: behind > 0 ? 'info' : 'secondary'
    }
  })
</script>

<SidePane item={selected}>
  <Page title={nameOf(repo.path)}>
    {#snippet subtitle()}
      <p class="truncate font-mono text-xs text-muted-foreground select-text">{tilde(repo.path)}</p>
    {/snippet}

    {#snippet actions()}
      {#if diverged(entry)}
        <PullButton {repos} {entry} command="rebase" size="pill" />
      {/if}
      <PullButton {repos} {entry} command="pull" size="pill" />
    {/snippet}

    <dl class="mt-6 grid grid-cols-[96px_1fr] items-center gap-x-4 gap-y-2">
      <dt class="text-muted-foreground">Branch</dt>
      <dd class="truncate font-mono text-xs/[18px] select-text">{repo.branch}</dd>
      <dt class="text-muted-foreground">Upstream</dt>
      <dd class="flex min-w-0 items-center gap-2">
        <span class="truncate font-mono text-xs/[18px] select-text">{repo.upstream}</span>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </dd>
      <dt class="text-muted-foreground">Remote</dt>
      <dd class="truncate font-mono text-xs/[18px] select-text">{repo.remote}</dd>
    </dl>

    {#if task?.status === 'failed'}
      <div class="mt-8">
        <FailureAlert
          title={task.command === 'fetch' ? 'Fetch failed' : 'Pull failed'}
          message={task.message}
        />
      </div>
    {/if}

    {#if unpushed.length > 0 || pushed.length > 0}
      <section class="mt-8 flex min-h-0 flex-col">
        <div class="flex items-center justify-between gap-4">
          <h2 class="text-muted-foreground">Recent commits</h2>
          {#if unpushed.length > 0}
            <Button
              variant="ghost"
              size="sm"
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
          {/if}
        </div>
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
      </section>
    {/if}
  </Page>

  {#snippet pane(commit, revealed)}
    <CommitDiff path={repo.path} {commit} {revealed} onclose={() => (selected = undefined)} />
  {/snippet}
</SidePane>

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
          <!-- The title's flex display defeats clamping, so the inner spans clamp instead. -->
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
