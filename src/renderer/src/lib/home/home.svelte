<script lang="ts">
  import IconArrowRight from '@tabler/icons-svelte/icons/arrow-right'
  import StatusDot from '$lib/components/status-dot.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Table from '$lib/components/ui/table'
  import {
    labelOf,
    megabytes,
    releaseOf,
    type Apps,
    type Entry as AppEntry
  } from '$lib/apps/apps.svelte'
  import AppUpgradeButton from '$lib/apps/upgrade-button.svelte'
  import { idOf, type Entry as PackageEntry, type Packages } from '$lib/packages/packages.svelte'
  import PackageUpgradeButton from '$lib/packages/upgrade-button.svelte'
  import { dirOf, nameOf, tilde } from '$lib/paths'
  import PullButton from '$lib/repos/pull-button.svelte'
  import {
    behind,
    diverged,
    runningPull,
    statusOf,
    type Entry as RepoEntry,
    type Workspace
  } from '$lib/repos/workspace.svelte'
  import { ago } from '$lib/time'

  let {
    apps,
    packages,
    workspace,
    pending
  }: { apps: Apps; packages: Packages; workspace: Workspace; pending: number } = $props()

  const appsChecked = $derived(apps.entries.some(({ task }) => settled(task)))
  const packagesChecked = $derived(settled(packages.check))
  const reposChecked = $derived(workspace.entries.some(({ task }) => settled(task)))
  const checked = $derived(appsChecked || packagesChecked || reposChecked)
  const busy = $derived(apps.busy || packages.busy || workspace.busy)
  const scanning = $derived(apps.scanning || packages.scanning || workspace.scanning)

  const checking = $derived(apps.checking || packages.checking || workspace.checking)
  const upgrading = $derived(apps.upgrading || packages.upgrading || workspace.pulling)

  const appRows = $derived(
    apps.entries.filter((entry) => releaseOf(entry) || entry.task?.status === 'failed')
  )

  // Fetching flashes through every repo, so only pulls count as activity worth a row.
  const repoRows = $derived(
    workspace.entries.filter(
      (entry) => behind(entry) || entry.task?.status === 'failed' || runningPull(entry)
    )
  )

  const list = new Intl.ListFormat('en')

  const headline = $derived.by(() => {
    if (scanning) return 'Scanning'

    if (checking) return 'Checking for upgrades'

    if (pending > 0) return `${plural(pending, 'upgrade', 'upgrades')} waiting`

    if (apps.checkFailed || packages.check?.status === 'failed' || workspace.checkFailed) {
      return 'Some checks failed'
    }

    return checked ? 'Everything is up to date' : 'Nothing checked yet'
  })

  const subtitle = $derived.by(() => {
    if (scanning) return 'Listing applications, packages, and repositories.'

    const lagging = [
      apps.outdated.length > 0 && plural(apps.outdated.length, 'application', 'applications'),
      packages.outdated.length > 0 && plural(packages.outdated.length, 'package', 'packages'),
      workspace.outdated.length > 0 &&
        plural(workspace.outdated.length, 'repository', 'repositories')
    ].filter((count) => count !== false)

    if (lagging.length > 0) return `${list.format(lagging)} behind.`

    const requested = packages.entries.filter(({ package: pkg }) => pkg.requested)

    const installed = [
      plural(apps.entries.length, 'application', 'applications'),
      packages.installed && plural(requested.length, 'package', 'packages')
    ].filter((count) => count !== false)

    return `${list.format(installed)} installed, ${plural(workspace.entries.length, 'repository', 'repositories')} under ${tilde(workspace.root)}.`
  })

  function settled(task: { status: string } | undefined): boolean {
    return task !== undefined && task.status !== 'running'
  }

  function plural(n: number, one: string, many: string): string {
    return `${n} ${n === 1 ? one : many}`
  }

  function check(): void {
    apps.refresh()
    packages.refresh()
    workspace.refresh()
  }

  function upgradeAll(): void {
    apps.upgrade(apps.outdated)
    packages.upgrade(packages.outdated)
    workspace.pullAll()
  }
</script>

<div class="scroll-fade-y absolute inset-0 my-2 overflow-y-auto px-8 py-6">
  <div class="flex items-start justify-between gap-4">
    <div class="flex min-w-0 flex-col gap-1">
      <h1 class="truncate text-xl font-semibold tracking-tight">{headline}</h1>
      <p class="truncate text-muted-foreground">{subtitle}</p>
    </div>
    <div class="flex gap-2 [-webkit-app-region:no-drag]">
      <Button size="pill" variant="secondary" disabled={busy} onclick={check}>
        {#if checking}
          Checking
        {:else if checked}
          Check again
        {:else}
          Check for upgrades
        {/if}
      </Button>
      <Button size="pill" disabled={busy || pending === 0} onclick={upgradeAll}>
        {upgrading ? 'Upgrading' : 'Upgrade everything'}
      </Button>
    </div>
  </div>

  <section class="mt-8">
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
                  onclick={() => apps.upgrade(apps.outdated)}
                >
                  Upgrade all {apps.outdated.length}
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

  {#if packages.installed}
    <section class="mt-8">
      <Table.Root>
        <colgroup>
          <col class="w-10" />
          <col class="w-48" />
          <col />
          <col class="w-28" />
          <col class="w-40" />
        </colgroup>
        <Table.Header>
          <Table.Row>
            <Table.Head colspan={4}>Packages</Table.Head>
            <Table.Head>
              {#if packages.outdated.length > 0}
                <div class="text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={packages.busy}
                    onclick={() => packages.upgrade(packages.outdated)}
                  >
                    Upgrade all {packages.outdated.length}
                  </Button>
                </div>
              {/if}
            </Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each packages.outdated as entry (idOf(entry.package))}
            {@render packageRow(entry)}
          {/each}
          {#if packages.check?.status === 'failed'}
            <Table.Row>
              <Table.Cell colspan={5}>
                <div class="w-0 min-w-full truncate text-destructive">{packages.check.message}</div>
              </Table.Cell>
            </Table.Row>
          {:else if packages.outdated.length === 0}
            <Table.Row>
              <Table.Cell colspan={5}>
                <span class="text-muted-foreground">
                  {packages.entries.length === 0
                    ? 'No packages.'
                    : packagesChecked
                      ? 'All up to date.'
                      : 'Not checked yet.'}
                </span>
              </Table.Cell>
            </Table.Row>
          {/if}
        </Table.Body>
      </Table.Root>
    </section>
  {/if}

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

<!-- Auto table layout widens a column to fit its content, so long text truncates inside a block
     that is zero wide until it stretches to the cell. -->
{#snippet appRow(entry: AppEntry)}
  {@const { app, task } = entry}
  {@const release = releaseOf(entry)}
  <Table.Row>
    <Table.Cell><img src={app.icon} alt="" class="size-6" /></Table.Cell>
    <Table.Cell><div class="w-0 min-w-full truncate text-base">{app.name}</div></Table.Cell>
    {#if task?.status === 'failed'}
      <Table.Cell colspan={3}>
        <div class="w-0 min-w-full truncate text-destructive">{task.message}</div>
      </Table.Cell>
    {:else if release}
      <Table.Cell>
        <div class="flex w-0 min-w-full items-center gap-2 font-mono text-xs/[18px]">
          <span class="truncate text-muted-foreground">{labelOf(app)}</span>
          <IconArrowRight class="size-3 shrink-0 text-muted-foreground" />
          <span class="truncate">{labelOf(release)}</span>
        </div>
      </Table.Cell>
      <Table.Cell>
        <div class="text-right text-muted-foreground">
          {#if release.size !== undefined}{megabytes(release.size)}{/if}
        </div>
      </Table.Cell>
      <Table.Cell>
        <div class="text-right text-muted-foreground">
          {#if release.date !== undefined}{ago(release.date)}{/if}
        </div>
      </Table.Cell>
    {/if}
    <Table.Cell>
      {#if release}
        <div class="text-right">
          <AppUpgradeButton {apps} {entry} size="sm" />
        </div>
      {/if}
    </Table.Cell>
  </Table.Row>
{/snippet}

{#snippet packageRow(entry: PackageEntry)}
  {@const { package: pkg, task } = entry}
  <Table.Row>
    <Table.Cell>
      <div class="flex w-6 justify-center"><StatusDot status={packages.statusOf(entry)} /></div>
    </Table.Cell>
    <Table.Cell><div class="w-0 min-w-full truncate text-base">{pkg.name}</div></Table.Cell>
    {#if task?.status === 'failed'}
      <Table.Cell colspan={2}>
        <div class="w-0 min-w-full truncate text-destructive">{task.message}</div>
      </Table.Cell>
    {:else}
      <Table.Cell>
        <div class="flex w-0 min-w-full items-center gap-2 font-mono text-xs/[18px]">
          <span class="truncate text-muted-foreground">{pkg.version}</span>
          <IconArrowRight class="size-3 shrink-0 text-muted-foreground" />
          <span class="truncate">{pkg.latest}</span>
        </div>
      </Table.Cell>
      <Table.Cell>
        <div class="text-right text-muted-foreground">
          {#if pkg.kind === 'cask'}
            Cask
          {:else if !pkg.requested}
            Dependency
          {/if}
        </div>
      </Table.Cell>
    {/if}
    <Table.Cell>
      <div class="text-right">
        <PackageUpgradeButton {packages} {entry} size="sm" />
      </div>
    </Table.Cell>
  </Table.Row>
{/snippet}

{#snippet repoRow(entry: RepoEntry)}
  {@const { repo, task } = entry}
  {@const dir = dirOf(repo.path)}
  {@const pull = runningPull(entry)}
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
      {#if behind(entry) || pull}
        <div class="text-right">
          <PullButton
            {workspace}
            {entry}
            command={pull ?? (diverged(entry) ? 'rebase' : 'pull')}
            size="sm"
          />
        </div>
      {/if}
    </Table.Cell>
  </Table.Row>
{/snippet}
