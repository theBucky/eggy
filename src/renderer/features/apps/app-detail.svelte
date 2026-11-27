<script lang="ts">
  import { nameOf, tilde } from '$client/paths'
  import FailureAlert from '$primitives/failure-alert.svelte'
  import { ago, megabytes } from '$primitives/format'
  import MetaList from '$primitives/meta-list.svelte'
  import Page from '$primitives/page.svelte'
  import Section from '$primitives/section.svelte'
  import { Badge } from '$primitives/ui/badge'
  import { Button } from '$primitives/ui/button'
  import type { StatusBadge } from '$source/status'
  import { failureOf, labelOf, releaseOf, type Apps, type Entry } from './apps.svelte'
  import ReleaseNotes from './release-notes.svelte'
  import UpgradeButton from './upgrade-button.svelte'

  let { apps, entry }: { apps: Apps; entry: Entry } = $props()

  const { app, check } = $derived(entry)
  const release = $derived(releaseOf(entry))
  const failed = $derived(failureOf(entry))

  const feedLabel = $derived.by(() => {
    const { origin, pathname } = new URL(app.feed)

    return origin + pathname.split('/', 2).join('/')
  })

  const badge = $derived.by((): StatusBadge | undefined => {
    if (check?.status === 'running') return { label: 'Checking', variant: 'secondary' }

    if (release !== undefined) return { label: 'Upgrade available', variant: 'info' }

    if (check?.status === 'failed') return { label: 'Check failed', variant: 'destructive' }

    if (entry.upgrade?.status === 'upgraded') return { label: 'Upgraded', variant: 'success' }

    return check === undefined ? undefined : { label: 'Up to date', variant: 'success' }
  })
</script>

<Page title={app.name} icon={app.icon} actions={release ? upgrade : undefined}>
  {#snippet subtitle()}
    <p class="truncate font-mono text-xs text-muted-foreground select-text">{tilde(app.path)}</p>
  {/snippet}

  <MetaList>
    <dt>Installed</dt>
    <dd class="flex min-w-0 items-center gap-2">
      <span class="truncate font-mono text-xs select-text">{labelOf(app)}</span>
      {#if badge}
        <Badge variant={badge.variant}>{badge.label}</Badge>
      {/if}
    </dd>
    {#if release}
      <dt>Latest</dt>
      <dd class="flex min-w-0 items-center gap-2">
        <span class="truncate font-mono text-xs select-text">{labelOf(release)}</span>
        {#if release.date !== undefined}
          <span class="shrink-0 text-xs text-muted-foreground">{ago(release.date)}</span>
        {/if}
      </dd>
      <dt>Download</dt>
      <dd class="flex min-w-0 gap-2 font-mono text-xs">
        <span class="truncate select-text"
          >{decodeURIComponent(nameOf(new URL(release.url).pathname))}</span
        >
        {#if release.size !== undefined}
          <span class="shrink-0 text-muted-foreground">{megabytes(release.size)}</span>
        {/if}
      </dd>
    {/if}
    <dt>Feed</dt>
    <dd class="-ml-2 flex font-mono">
      <Button variant="link" size="sm" href={app.feed} target="_blank">{feedLabel}</Button>
    </dd>
  </MetaList>

  {#if failed}
    <FailureAlert
      title={entry.upgrade?.status === 'failed' ? 'Upgrade failed' : 'Check failed'}
      message={failed.message}
    />
  {/if}

  {#if release?.notes}
    <Section title="Release notes">
      <div class="scroll-section">
        <ReleaseNotes notes={release.notes} />
      </div>
    </Section>
  {/if}
</Page>

{#snippet upgrade()}
  <UpgradeButton {apps} {entry} variant="primary" />
{/snippet}
