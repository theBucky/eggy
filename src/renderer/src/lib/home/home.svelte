<script lang="ts">
  import AppCard from '$lib/apps/app-card.svelte'
  import Page from '$lib/components/page.svelte'
  import { Button } from '$lib/components/ui/button'
  import PackageCard from '$lib/packages/package-card.svelte'
  import { tilde } from '$lib/paths'
  import RepoCard from '$lib/repos/repo-card.svelte'
  import type { Sources } from '$lib/sources.svelte'
  import type { Detail } from '$lib/view'
  import { list, plural } from '$shared/english'

  let { sources, onselect }: { sources: Sources; onselect: (detail: Detail) => void } = $props()

  const { apps, packages, repos } = $derived(sources)

  const headline = $derived.by(() => {
    if (sources.scanning) return 'Scanning'

    if (sources.checking) return 'Checking for upgrades'

    if (sources.outdated > 0) return `${plural(sources.outdated, 'upgrade', 'upgrades')} waiting`

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

    const installed = [
      plural(apps.entries.length, 'application', 'applications'),
      packages.installed && plural(packages.requested.length, 'package', 'packages')
    ].filter((count) => count !== false)

    return `${list.format(installed)} installed, ${plural(repos.entries.length, 'repository', 'repositories')} under ${tilde(repos.root)}.`
  })
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
      disabled={sources.busy || sources.outdated === 0}
      onclick={() => sources.upgradeOutdated()}
    >
      {sources.bulk ? 'Upgrading' : 'Upgrade everything'}
    </Button>
  {/snippet}

  <AppCard {apps} onselect={(id) => onselect({ page: 'app', id })} />
  {#if packages.installed}
    <PackageCard {packages} />
  {/if}
  <RepoCard {repos} onselect={(id) => onselect({ page: 'repo', id })} />
</Page>
