<script lang="ts">
  import IconChevronDown from '@tabler/icons-svelte/icons/chevron-down'
  import IconChevronUp from '@tabler/icons-svelte/icons/chevron-up'
  import FailureAlert from '$lib/components/failure-alert.svelte'
  import SidePane from '$lib/components/side-pane.svelte'
  import { Badge, type BadgeVariant } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import * as Item from '$lib/components/ui/item'
  import { Spinner } from '$lib/components/ui/spinner'
  import { nameOf, tilde } from '$lib/paths'
  import { ago } from '$lib/time'
  import CommitDiff from '$lib/repos/commit-diff.svelte'
  import type { Entry, Workspace } from '$lib/repos/workspace.svelte'
  import type { Commit } from '$shared/api'

  type SyncBadge = { label: string; variant: BadgeVariant }

  let { workspace, entry }: { workspace: Workspace; entry: Entry } = $props()

  const { repo, task } = $derived(entry)
  const { unpushed, pushed } = $derived(repo.history)

  let showUnpushed = $state(false)
  let selected = $state<Commit>()

  const diverged = $derived(repo.sync !== undefined && repo.sync.ahead > 0 && repo.sync.behind > 0)

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
  <div class="scroll-fade-y my-2 flex min-h-0 flex-1 flex-col overflow-y-auto px-8 py-6">
    <div class="flex items-start justify-between gap-4">
      <div class="flex min-w-0 flex-col gap-1">
        <h1 class="truncate text-xl font-semibold tracking-tight">{nameOf(repo.path)}</h1>
        <p class="truncate font-mono text-xs text-muted-foreground">{tilde(repo.path)}</p>
      </div>
      <div class="flex gap-2 [-webkit-app-region:no-drag]">
        {#if diverged}
          <Button
            size="lg"
            variant="destructive"
            disabled={workspace.busy}
            onclick={() => workspace.pull(entry, 'rebase')}
          >
            {#if task?.command === 'rebase' && task.status === 'running'}
              <Spinner data-icon="inline-start" />
              Rebasing
            {:else}
              Rebase and pull
            {/if}
          </Button>
        {/if}
        <Button size="lg" disabled={workspace.busy} onclick={() => workspace.pull(entry, 'pull')}>
          {#if task?.command === 'pull' && task.status === 'running'}
            <Spinner data-icon="inline-start" />
            Pulling
          {:else}
            Pull
          {/if}
        </Button>
      </div>
    </div>

    <dl class="mt-6 grid grid-cols-[96px_1fr] items-center gap-x-4 gap-y-2">
      <dt class="text-muted-foreground">Branch</dt>
      <dd class="truncate font-mono text-xs/[18px]">{repo.branch}</dd>
      <dt class="text-muted-foreground">Upstream</dt>
      <dd class="flex min-w-0 items-center gap-2">
        <span class="truncate font-mono text-xs/[18px]">{repo.upstream}</span>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </dd>
      <dt class="text-muted-foreground">Remote</dt>
      <dd class="truncate font-mono text-xs/[18px]">{repo.remote}</dd>
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
        <div class="scroll-fade-y -mx-scrollbar my-2 min-h-0 overflow-y-auto px-scrollbar py-1">
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
  </div>

  {#snippet pane(commit, revealed)}
    <CommitDiff path={repo.path} {commit} {revealed} onclose={() => (selected = undefined)} />
  {/snippet}
</SidePane>

{#snippet row(commit: Commit, published: boolean)}
  {@const active = commit.hash === selected?.hash}
  <div role="listitem" class={['rounded-md', !published && 'opacity-50', active && 'bg-selected']}>
    <Item.Root size="xs">
      {#snippet child({ props })}
        <button
          {...props}
          type="button"
          aria-pressed={active}
          onclick={() => (selected = active ? undefined : commit)}
        >
          <!-- the title's flex display defeats clamping, so the inner spans clamp instead. -->
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
