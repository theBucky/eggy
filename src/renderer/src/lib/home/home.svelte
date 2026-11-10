<script lang="ts">
  import IconArrowRight from '@tabler/icons-svelte/icons/arrow-right'
  import Page from '$lib/components/page.svelte'
  import StatusDot from '$lib/components/status-dot.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Table from '$lib/components/ui/table'
  import { labelOf, releaseOf, type Apps, type Entry as AppEntry } from '$lib/apps/apps.svelte'
  import AppUpgradeButton from '$lib/apps/upgrade-button.svelte'
  import { ago, list, megabytes } from '$lib/format'
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
    type Repos
  } from '$lib/repos/repos.svelte'
  import type { Source } from '$lib/sources.svelte'
  import { plural } from '$shared/plural'

  let {
    apps,
    packages,
    repos,
    sources
  }: { apps: Apps; packages: Packages; repos: Repos; sources: Source } = $props()

  const pending = $derived(sources.outdated.length)

  const appRows = $derived(
    apps.entries.filter((entry) => releaseOf(entry) || entry.task?.status === 'failed')
  )

  // Fetching flashes through every repo, so only pulls count as activity worth a row.
  const repoRows = $derived(
    repos.entries.filter(
      (entry) => behind(entry) || entry.task?.status === 'failed' || runningPull(entry)
    )
  )

  const headline = $derived.by(() => {
    if (sources.scanning) return 'Scanning'

    if (sources.checking) return 'Checking for upgrades'

    if (pending > 0) return `${plural(pending, 'upgrade', 'upgrades')} waiting`

    if (sources.checkFailed) return 'Some checks failed'

    return sources.checked ? 'Everything is up to date' : 'Nothing checked yet'
  })

  const summary = $derived.by(() => {
    if (sources.scanning) return 'Listing applications, packages, and repositories.'

    const lagging = [
      apps.outdated.length > 0 && plural(apps.outdated.length, 'application', 'applications'),
      packages.outdated.length > 0 && plural(packages.outdated.length, 'package', 'packages'),
      repos.outdated.length > 0 && plural(repos.outdated.length, 'repository', 'repositories')
    ].filter((count) => count !== false)

    if (lagging.length > 0) return `${list.format(lagging)} behind.`

    const requested = packages.entries.filter(({ package: pkg }) => pkg.requested)

    const installed = [
      plural(apps.entries.length, 'application', 'applications'),
      packages.installed && plural(requested.length, 'package', 'packages')
    ].filter((count) => count !== false)

    return `${list.format(installed)} installed, ${plural(repos.entries.length, 'repository', 'repositories')} under ${tilde(repos.root)}.`
  })

  function standing(source: Source): string {
    return source.checked ? 'All up to date.' : 'Not checked yet.'
  }
</script>

<Page title={headline}>
  {#snippet subtitle()}
    <p class="truncate text-muted-foreground">{summary}</p>
  {/snippet}

  {#snippet actions()}
    <Button
      size="pill"
      variant="secondary"
      disabled={sources.busy}
      onclick={() => sources.refresh()}
    >
      {#if sources.checking}
        Checking
      {:else if sources.checked}
        Check again
      {:else}
        Check for upgrades
      {/if}
    </Button>
    <Button
      size="pill"
      disabled={sources.busy || pending === 0}
      onclick={() => sources.upgradeOutdated()}
    >
      {sources.upgrading ? 'Upgrading' : 'Upgrade everything'}
    </Button>
  {/snippet}

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
          <Table.Head>{@render upgradeAll(apps, 'Upgrade')}</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each appRows as entry (entry.app.path)}
          {@render appRow(entry)}
        {:else}
          {@render note(6, apps.entries.length === 0 ? 'No applications.' : standing(apps))}
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
            <Table.Head>{@render upgradeAll(packages, 'Upgrade')}</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each packages.outdated as entry (idOf(entry.package))}
            {@render packageRow(entry)}
          {/each}
          {#if packages.check?.status === 'failed'}
            <Table.Row>
              <Table.Cell colspan={5}>
                <div class="fill-cell truncate text-destructive">{packages.check.message}</div>
              </Table.Cell>
            </Table.Row>
          {:else if packages.outdated.length === 0}
            {@render note(5, packages.entries.length === 0 ? 'No packages.' : standing(packages))}
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
          <Table.Head>{@render upgradeAll(repos, 'Pull')}</Table.Head>
        </Table.Row>
      </Table.Header>
      <Table.Body>
        {#each repoRows as entry (entry.repo.path)}
          {@render repoRow(entry)}
        {:else}
          {@render note(
            5,
            repos.entries.length === 0
              ? `Nothing under ${tilde(repos.root)} tracks an upstream branch.`
              : standing(repos)
          )}
        {/each}
      </Table.Body>
    </Table.Root>
  </section>
</Page>

{#snippet upgradeAll(source: Source, verb: string)}
  {#if source.outdated.length > 0}
    <div class="text-right">
      <Button
        variant="ghost"
        size="sm"
        disabled={source.busy}
        onclick={() => source.upgradeOutdated()}
      >
        {verb} all {source.outdated.length}
      </Button>
    </div>
  {/if}
{/snippet}

{#snippet note(colspan: number, text: string)}
  <Table.Row>
    <Table.Cell {colspan}>
      <span class="text-muted-foreground">{text}</span>
    </Table.Cell>
  </Table.Row>
{/snippet}

{#snippet appRow(entry: AppEntry)}
  {@const { app, task } = entry}
  {@const release = releaseOf(entry)}
  <Table.Row>
    <Table.Cell><img src={app.icon} alt="" class="size-6" /></Table.Cell>
    <Table.Cell><div class="fill-cell truncate text-base">{app.name}</div></Table.Cell>
    {#if task?.status === 'failed'}
      <Table.Cell colspan={3}>
        <div class="fill-cell truncate text-destructive">{task.message}</div>
      </Table.Cell>
    {:else if release}
      <Table.Cell>
        <div class="flex fill-cell items-center gap-2 font-mono text-xs/[18px]">
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
    <Table.Cell><div class="fill-cell truncate text-base">{pkg.name}</div></Table.Cell>
    {#if task?.status === 'failed'}
      <Table.Cell colspan={2}>
        <div class="fill-cell truncate text-destructive">{task.message}</div>
      </Table.Cell>
    {:else}
      <Table.Cell>
        <div class="flex fill-cell items-center gap-2 font-mono text-xs/[18px]">
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
      <div class="fill-cell truncate text-base">
        {nameOf(repo.path)}
        {#if dir !== repos.root}
          <span class="text-xs text-muted-foreground">{repos.relative(dir)}</span>
        {/if}
      </div>
    </Table.Cell>
    <Table.Cell>
      {#if task?.status === 'failed'}
        <div class="fill-cell truncate text-destructive">{task.message}</div>
      {:else}
        <div class="fill-cell truncate font-mono text-xs/[18px] text-muted-foreground">
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
            {repos}
            {entry}
            command={pull ?? (diverged(entry) ? 'rebase' : 'pull')}
            size="sm"
          />
        </div>
      {/if}
    </Table.Cell>
  </Table.Row>
{/snippet}
