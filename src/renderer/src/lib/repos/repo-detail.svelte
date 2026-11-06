<script lang="ts">
  import IconChevronDown from '@tabler/icons-svelte/icons/chevron-down'
  import IconChevronUp from '@tabler/icons-svelte/icons/chevron-up'
  import FailureAlert from '$lib/components/failure-alert.svelte'
  import { Badge, type BadgeVariant } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import * as Item from '$lib/components/ui/item'
  import { Spinner } from '$lib/components/ui/spinner'
  import { nameOf, tilde } from '$lib/paths'
  import { ago } from '$lib/time'
  import CommitDiff from '$lib/repos/commit-diff.svelte'
  import type { Entry, Workspace } from '$lib/repos/workspace.svelte'
  import type { Commit } from '../../../../shared/api'

  type SyncBadge = { label: string; variant: BadgeVariant }

  // The pane shows `commit`, whose page upstream is `url`, and points open or shut. While it slides,
  // it's `slide.width` wide and its content holds `slide.content` pixels, which keeps the content
  // still against the moving edges.
  type Pane = {
    commit: Commit
    url: string | undefined
    open: boolean
    slide: { width: string; content: number } | undefined
  }

  // The pane's width, of which the column gives up `COLUMN_SHARE` and the window grows by the rest,
  // so the app stays narrow enough to sit on most screens.
  const PANE_WIDTH = 640
  const COLUMN_SHARE = 160
  const COLUMN_MIN_WIDTH = 384

  let { workspace, entry }: { workspace: Workspace; entry: Entry } = $props()

  const { repo, task } = $derived(entry)
  const { unpushed, pushed } = $derived(repo.history)

  let layout: HTMLElement
  let wrapper = $state<HTMLElement>()
  let showUnpushed = $state(false)
  let pane = $state.raw<Pane>()

  let destroyed = false

  const selected = $derived(pane?.open ? pane.commit : undefined)
  const sliding = $derived(pane?.slide)

  // The pane reads these rather than `pane`, so its effects skip the steps of a slide. Content
  // shows once the pane has come to rest open, never half in view.
  const shown = $derived(pane?.commit)
  const shownUrl = $derived(pane?.url)
  const revealed = $derived(pane?.open === true && pane.slide === undefined)

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

  $effect(() => () => {
    destroyed = true
    window.api.collapseWindow().then(() => window.api.moveWindow())
  })

  function select(commit: Commit, published: boolean): void {
    if (pane?.open && pane.commit.hash === commit.hash) return dismiss()

    const url = repo.commitUrl && published ? repo.commitUrl + commit.hash : undefined

    steer({ commit, url, open: true })
  }

  function dismiss(): void {
    if (pane?.open) steer({ ...pane, open: false })
  }

  // Points the pane open or shut. A slide under way runs to its end before turning, since the
  // window's move can't turn midway.
  function steer(next: Omit<Pane, 'slide'>): void {
    const resting = pane?.slide === undefined
    const opened = pane !== undefined

    pane = { ...next, slide: pane?.slide }

    if (resting && next.open !== opened) slide(next.open)
  }

  // Slides the pane open from shut or shut from open, then on to wherever it points by then. The
  // window grows while the column gives up its share, and whatever growth the screen can't fit
  // comes out of the column too.
  async function slide(open: boolean): Promise<void> {
    const from = open ? 0 : wrapper!.getBoundingClientRect().width

    // The pane holds still until the window replies.
    pane = { ...pane!, slide: { width: `${from}px`, content: open ? PANE_WIDTH : from } }

    const grown = open
      ? await window.api.expandWindow(PANE_WIDTH - COLUMN_SHARE)
      : await window.api.collapseWindow()

    if (destroyed) return

    // The layout takes all the window's growth, since the sidebar keeps its width.
    const to = open ? Math.min(PANE_WIDTH, layout.clientWidth + grown - COLUMN_MIN_WIDTH) : 0
    const content = Math.max(from, to)

    // Without the window's move to pace it, the slide plays the system's resize animation itself.
    if (grown === 0) {
      pane = { ...pane!, slide: { width: `${to}px`, content } }
      await wrapper!.animate([{ width: `${from}px` }, { width: `${to}px` }], {
        duration: 200,
        easing: 'ease-in-out'
      }).finished
    } else {
      // The pane's width follows the window's through each frame of the system's animation.
      const rate = (to - from) / grown

      pane = {
        ...pane!,
        slide: { width: `calc(${from}px + (100vw - ${window.innerWidth}px) * ${rate})`, content }
      }
      await window.api.moveWindow()
    }

    if (destroyed) return

    if (pane!.open !== open) return slide(pane!.open)

    pane = open ? { ...pane!, slide: undefined } : undefined
  }
</script>

<div bind:this={layout} class="absolute inset-0 flex">
  <div
    class="scroll-fade-y my-2 flex min-h-0 flex-1 flex-col overflow-y-auto px-8 py-6"
    style:min-width="{COLUMN_MIN_WIDTH}px"
  >
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

  {#if shown}
    <!-- Mid-slide, the pane content keeps its open width and rides the window's edge, and the
         wrapper's border stands in for the content's own, which sits just past the clip. -->
    <div
      bind:this={wrapper}
      class={['relative min-w-0', sliding && 'flex-none overflow-hidden border-l']}
      style:width={sliding?.width ?? `${PANE_WIDTH}px`}
    >
      <div
        class={sliding ? 'absolute inset-y-0 right-0' : 'size-full'}
        style:width={sliding ? `${sliding.content}px` : undefined}
      >
        <CommitDiff path={repo.path} commit={shown} url={shownUrl} {revealed} onclose={dismiss} />
      </div>
    </div>
  {/if}
</div>

{#snippet row(commit: Commit, published: boolean)}
  <div
    role="listitem"
    class={[
      'rounded-md',
      !published && 'opacity-50',
      commit.hash === selected?.hash &&
        'bg-[color-mix(in_srgb,var(--foreground)_8%,var(--background))]'
    ]}
  >
    <Item.Root size="xs">
      {#snippet child({ props })}
        <button
          {...props}
          type="button"
          aria-pressed={commit.hash === selected?.hash}
          onclick={() => select(commit, published)}
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
