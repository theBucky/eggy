<script lang="ts">
  import IconArrowRight from '@tabler/icons-svelte/icons/arrow-right'
  import StatusDot from '$lib/components/status-dot.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Spinner } from '$lib/components/ui/spinner'
  import * as Table from '$lib/components/ui/table'
  import {
    labelOf,
    megabytes,
    releaseOf,
    type Apps,
    type Entry as AppEntry
  } from '$lib/apps/apps.svelte'
  import UpdateButton from '$lib/apps/update-button.svelte'
  import { dirOf, nameOf, tilde } from '$lib/paths'
  import {
    diverged,
    pulling,
    statusOf,
    type Entry as RepoEntry,
    type Workspace
  } from '$lib/repos/workspace.svelte'
  import { ago } from '$lib/time'

  let { apps, workspace, pending }: { apps: Apps; workspace: Workspace; pending: number } = $props()

  const appsChecked = $derived(apps.entries.some(settled))
  const reposChecked = $derived(workspace.entries.some(settled))
  const checked = $derived(appsChecked || reposChecked)
  const busy = $derived(apps.busy || workspace.busy)
  const scanning = $derived(apps.scanning || workspace.scanning)

  const checking = $derived(apps.checking || workspace.checking)
  const updating = $derived(apps.updating || workspace.updating)

  const appRows = $derived(
    apps.entries.filter((entry) => apps.outdated.includes(entry) || entry.task?.status === 'failed')
  )

  // Fetching flashes through every repo, so only pulls count as activity worth a row.
  const repoRows = $derived(
    workspace.entries.filter(
      (entry) =>
        workspace.outdated.includes(entry) || entry.task?.status === 'failed' || pulling(entry)
    )
  )

  const failed = $derived(
    [...apps.entries, ...workspace.entries].some(
      ({ task }) =>
        task?.status === 'failed' && (task.command === 'check' || task.command === 'fetch')
    )
  )

  const headline = $derived.by(() => {
    if (scanning) return 'Scanning'

    if (checking) return 'Checking for updates'

    if (pending > 0) return `${plural(pending, 'update', 'updates')} waiting`

    if (failed) return 'Some checks failed'

    return checked ? 'Everything is up to date' : 'Nothing checked yet'
  })

  const subtitle = $derived.by(() => {
    if (scanning) return 'Listing applications and repositories.'

    const behind = [
      apps.outdated.length > 0 && plural(apps.outdated.length, 'application', 'applications'),
      workspace.outdated.length > 0 &&
        plural(workspace.outdated.length, 'repository', 'repositories')
    ].filter(Boolean)

    if (behind.length > 0) return `${behind.join(' and ')} behind.`

    return `${plural(apps.entries.length, 'application', 'applications')} installed, ${plural(workspace.entries.length, 'repository', 'repositories')} under ${tilde(workspace.root)}.`
  })

  function settled({ task }: AppEntry | RepoEntry): boolean {
    return task !== undefined && task.status !== 'running'
  }

  function plural(n: number, one: string, many: string): string {
    return `${n} ${n === 1 ? one : many}`
  }

  function check(): void {
    apps.refresh()
    workspace.refresh()
  }

  function updateAll(): void {
    apps.update(apps.outdated)
    workspace.pullAll()
  }
</script>

<div class="absolute inset-0 flex flex-col">
  <div class="scroll-fade-y my-2 flex min-h-0 flex-1 flex-col overflow-y-auto px-8 py-6">
    <div class="flex items-start justify-between gap-4">
      <div class="flex min-w-0 flex-col gap-1">
        <h1 class="truncate text-xl font-semibold tracking-tight">{headline}</h1>
        <p class="truncate text-muted-foreground">{subtitle}</p>
      </div>
      <div class="flex shrink-0 gap-2 [-webkit-app-region:no-drag]">
        <Button size="lg" variant="secondary" disabled={busy} onclick={check}>
          {#if checking}
            <Spinner data-icon="inline-start" />
            Checking
          {:else}
            {checked ? 'Check again' : 'Check for updates'}
          {/if}
        </Button>
        <Button size="lg" disabled={busy || pending === 0} onclick={updateAll}>
          {#if updating}
            <Spinner data-icon="inline-start" />
            Updating
          {:else}
            Update everything
          {/if}
        </Button>
      </div>
    </div>

    <section class="mt-10">
      <Table.Root>
        <colgroup>
          <col class="w-10" />
          <col class="w-48" />
          <col />
          <col class="w-22" />
          <col class="w-28" />
          <col class="w-40" />
        </colgroup>
        <Table.Header>
          <Table.Row>
            <Table.Head colspan={5}>Applications</Table.Head>
            <Table.Head>
              {#if apps.outdated.length > 0}
                <div class="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={apps.busy}
                    onclick={() => apps.update(apps.outdated)}
                  >
                    Update all {apps.outdated.length}
                  </Button>
                </div>
              {/if}
            </Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each appRows as entry (entry.app.path)}
            {@render appRow(entry)}
          {:else}
            <Table.Row>
              <Table.Cell colspan={6}>
                <span class="text-muted-foreground">
                  {apps.entries.length === 0
                    ? 'No applications.'
                    : appsChecked
                      ? 'All up to date.'
                      : 'Not checked yet.'}
                </span>
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </section>

    <section class="mt-8">
      <Table.Root>
        <colgroup>
          <col class="w-10" />
          <col class="w-48" />
          <col />
          <col class="w-22" />
          <col class="w-32" />
        </colgroup>
        <Table.Header>
          <Table.Row>
            <Table.Head colspan={4}>Repositories</Table.Head>
            <Table.Head>
              {#if workspace.outdated.length > 0}
                <div class="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={workspace.busy}
                    onclick={() => workspace.pullAll()}
                  >
                    Pull all {workspace.outdated.length}
                  </Button>
                </div>
              {/if}
            </Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each repoRows as entry (entry.repo.path)}
            {@render repoRow(entry)}
          {:else}
            <Table.Row>
              <Table.Cell colspan={5}>
                <span class="text-muted-foreground">
                  {workspace.entries.length === 0
                    ? `Nothing under ${tilde(workspace.root)} tracks an upstream branch.`
                    : reposChecked
                      ? 'All up to date.'
                      : 'Not checked yet.'}
                </span>
              </Table.Cell>
            </Table.Row>
          {/each}
        </Table.Body>
      </Table.Root>
    </section>
  </div>
</div>

<!-- Auto table layout widens a column to fit its content, so long text truncates inside a block
     that is zero wide until it stretches to the cell. -->
{#snippet appRow(entry: AppEntry)}
  {@const { app, task } = entry}
  {@const update = releaseOf(entry)}
  <Table.Row>
    <Table.Cell><img src={app.icon} alt="" class="size-6" /></Table.Cell>
    <Table.Cell><div class="w-0 min-w-full truncate text-base">{app.name}</div></Table.Cell>
    {#if task?.status === 'failed'}
      <Table.Cell colspan={3}>
        <div class="w-0 min-w-full truncate text-destructive">{task.message}</div>
      </Table.Cell>
    {:else if update}
      <Table.Cell>
        <div class="flex w-0 min-w-full items-center gap-2 font-mono text-xs/[18px]">
          <span class="min-w-0 truncate text-muted-foreground">{labelOf(app)}</span>
          <IconArrowRight class="size-3 shrink-0 text-muted-foreground" />
          <span class="min-w-0 truncate">{labelOf(update)}</span>
        </div>
      </Table.Cell>
      <Table.Cell>
        <div class="text-right text-muted-foreground">
          {#if update.size !== undefined}{megabytes(update.size)}{/if}
        </div>
      </Table.Cell>
      <Table.Cell>
        <div class="text-right text-muted-foreground">
          {#if update.date !== undefined}{ago(update.date)}{/if}
        </div>
      </Table.Cell>
    {/if}
    <Table.Cell>
      {#if update}
        <div class="text-right">
          <UpdateButton {apps} {entry} size="sm" />
        </div>
      {/if}
    </Table.Cell>
  </Table.Row>
{/snippet}

{#snippet repoRow(entry: RepoEntry)}
  {@const { repo, task } = entry}
  {@const dir = dirOf(repo.path)}
  {@const command = diverged(entry) ? 'rebase' : 'pull'}
  <Table.Row>
    <Table.Cell>
      <div class="flex w-6 justify-center"><StatusDot status={statusOf(entry)} /></div>
    </Table.Cell>
    <Table.Cell>
      <div class="w-0 min-w-full truncate text-base">
        {nameOf(repo.path)}
        {#if dir !== workspace.root}
          <span class="text-xs text-muted-foreground">{workspace.relative(dir)}</span>
        {/if}
      </div>
    </Table.Cell>
    <Table.Cell>
      {#if task?.status === 'failed'}
        <div class="w-0 min-w-full truncate text-destructive">{task.message}</div>
      {:else}
        <div class="w-0 min-w-full truncate font-mono text-xs/[18px] text-muted-foreground">
          {repo.branch} ← {repo.upstream}
        </div>
      {/if}
    </Table.Cell>
    <Table.Cell>
      <div class="text-right font-mono text-xs/[18px] text-info">
        {#if repo.sync?.ahead}↑{repo.sync.ahead}{/if}
        {#if repo.sync?.behind}↓{repo.sync.behind}{/if}
      </div>
    </Table.Cell>
    <Table.Cell>
      {#if workspace.outdated.includes(entry)}
        <div class="text-right">
          <Button
            size="sm"
            variant={command === 'rebase' ? 'destructive' : 'default'}
            disabled={workspace.busy}
            onclick={() => workspace.pull(entry, command)}
          >
            {#if pulling(entry)}
              <Spinner data-icon="inline-start" />
              {task?.command === 'rebase' ? 'Rebasing' : 'Pulling'}
            {:else}
              {command === 'rebase' ? 'Rebase and pull' : 'Pull'}
            {/if}
          </Button>
        </div>
      {/if}
    </Table.Cell>
  </Table.Row>
{/snippet}
