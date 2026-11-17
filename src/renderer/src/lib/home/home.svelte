<script lang="ts">
  import ListCard from '$lib/components/list-card.svelte'
  import Page from '$lib/components/page.svelte'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import * as Item from '$lib/components/ui/item'
  import { labelOf, releaseOf, type Apps, type Entry as AppEntry } from '$lib/apps/apps.svelte'
  import AppUpgradeButton from '$lib/apps/upgrade-button.svelte'
  import { list, megabytes } from '$lib/format'
  import { idOf, type Entry as PackageEntry, type Packages } from '$lib/packages/packages.svelte'
  import type { App, Package, Release } from '$shared/api'
  import PackageUpgradeButton from '$lib/packages/upgrade-button.svelte'
  import { nameOf, tilde } from '$lib/paths'
  import PullButton from '$lib/repos/pull-button.svelte'
  import {
    behind,
    diverged,
    offsetsOf,
    pendingPull,
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
      (entry) => behind(entry) || entry.task?.status === 'failed' || pendingPull(entry)
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

  function clauses(...parts: (string | false)[]): string {
    return parts.filter((part) => part !== false).join(', ')
  }

  function appMeta(app: App, release: Release): string {
    const bump =
      app.version === release.version
        ? `${labelOf(app)} → ${labelOf(release)}`
        : `${app.version} → ${release.version}`

    return clauses(bump, release.size !== undefined && megabytes(release.size))
  }

  function packageMeta(pkg: Package): string {
    return clauses(`${pkg.version} → ${pkg.latest}`, !pkg.requested && 'dependency')
  }

  function standing(source: Source): string {
    return source.checked ? 'Up to date.' : 'Not checked.'
  }
</script>

<Page title={headline}>
  {#snippet subtitle()}
    <p class="truncate text-muted-foreground">{summary}</p>
  {/snippet}

  {#snippet actions()}
    <Button variant="secondary" disabled={sources.busy} onclick={() => sources.refresh()}>
      {#if sources.checking}
        Checking
      {:else if sources.checked}
        Check again
      {:else}
        Check for upgrades
      {/if}
    </Button>
    <Button
      variant="primary"
      disabled={sources.busy || pending === 0}
      onclick={() => sources.upgradeOutdated()}
    >
      {sources.bulk ? 'Upgrading' : 'Upgrade everything'}
    </Button>
  {/snippet}

  <ListCard title="Applications">
    {#each appRows as entry, index (entry.app.path)}
      {#if index > 0}<Item.Separator decorative />{/if}
      {@render appRow(entry)}
    {:else}
      {@render note(apps.entries.length === 0 ? 'No applications.' : standing(apps))}
    {/each}
  </ListCard>

  {#if packages.installed}
    <ListCard title="Packages">
      {#each packages.outdated as entry, index (idOf(entry.package))}
        {#if index > 0}<Item.Separator decorative />{/if}
        {@render packageRow(entry)}
      {/each}
      {#if packages.check?.status === 'failed'}
        {#if packages.outdated.length > 0}<Item.Separator decorative />{/if}
        {@render note(packages.check.message, true)}
      {:else if packages.outdated.length === 0}
        {@render note(packages.entries.length === 0 ? 'No packages.' : standing(packages))}
      {/if}
    </ListCard>
  {/if}

  <ListCard title="Repositories">
    {#each repoRows as entry, index (entry.repo.path)}
      {#if index > 0}<Item.Separator decorative />{/if}
      {@render repoRow(entry)}
    {:else}
      {@render note(
        repos.entries.length === 0
          ? `Nothing under ${tilde(repos.root)} tracks an upstream branch.`
          : standing(repos)
      )}
    {/each}
  </ListCard>
</Page>

{#snippet note(text: string, failed = false)}
  <Item.Root size="xs" role="listitem">
    <Item.Content>
      <Item.Description>
        {#if failed}
          {@render failure(text)}
        {:else}
          {text}
        {/if}
      </Item.Description>
    </Item.Content>
  </Item.Root>
{/snippet}

{#snippet meta(text: string)}
  <span class="font-mono">{text}</span>
{/snippet}

{#snippet failure(message: string)}
  <span class="text-destructive">{message}</span>
{/snippet}

{#snippet appRow(entry: AppEntry)}
  {@const { app, task } = entry}
  {@const release = releaseOf(entry)}
  <Item.Root size="xs" role="listitem">
    <Item.Media variant="image"><img src={app.icon} alt="" /></Item.Media>
    <Item.Content>
      <Item.Title><span class="line-clamp-1">{app.name}</span></Item.Title>
      <Item.Description>
        {#if task?.status === 'failed'}
          {@render failure(task.message)}
        {:else if release}
          {@render meta(appMeta(app, release))}
        {/if}
      </Item.Description>
    </Item.Content>
    {#if release}
      <Item.Actions><AppUpgradeButton {apps} {entry} /></Item.Actions>
    {/if}
  </Item.Root>
{/snippet}

{#snippet packageRow(entry: PackageEntry)}
  {@const { package: pkg, task } = entry}
  <Item.Root size="xs" role="listitem">
    <Item.Content>
      <Item.Title><span class="line-clamp-1">{pkg.name}</span></Item.Title>
      <Item.Description>
        {#if task?.status === 'failed'}
          {@render failure(task.message)}
        {:else}
          {@render meta(packageMeta(pkg))}
        {/if}
      </Item.Description>
    </Item.Content>
    <Item.Actions><PackageUpgradeButton {packages} {entry} /></Item.Actions>
  </Item.Root>
{/snippet}

{#snippet repoRow(entry: RepoEntry)}
  {@const { repo, task } = entry}
  {@const pull = pendingPull(entry)}
  <Item.Root size="xs" role="listitem">
    <Item.Content>
      <Item.Title>
        <Badge variant="secondary">{repo.branch}</Badge>
        <span class="shrink-0">{nameOf(repo.path)}</span>
        <Item.Description>
          <span class="line-clamp-1 wrap-anywhere">
            {#if task?.status === 'failed'}
              {@render failure(task.message)}
            {:else}
              {repo.sync && offsetsOf(repo.sync)}
            {/if}
          </span>
        </Item.Description>
      </Item.Title>
    </Item.Content>
    {#if behind(entry) || pull}
      <Item.Actions>
        <PullButton {repos} {entry} command={pull ?? (diverged(entry) ? 'rebase' : 'pull')} />
      </Item.Actions>
    {/if}
  </Item.Root>
{/snippet}
