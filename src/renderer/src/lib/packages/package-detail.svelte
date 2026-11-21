<script lang="ts" module>
  import { on } from 'svelte/events'

  function follow(node: HTMLElement): () => void {
    let following = true

    const observer = new MutationObserver(() => {
      if (following) node.scrollTop = node.scrollHeight
    })

    const off = on(node, 'scroll', () => {
      following = node.scrollHeight - node.scrollTop - node.clientHeight < 1
    })

    observer.observe(node, { childList: true, subtree: true, characterData: true })

    return () => {
      observer.disconnect()
      off()
    }
  }
</script>

<script lang="ts">
  import FailureAlert from '$lib/components/failure-alert.svelte'
  import MetaList from '$lib/components/meta-list.svelte'
  import Page from '$lib/components/page.svelte'
  import Section from '$lib/components/section.svelte'
  import { Badge } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import type { Entry, Packages } from '$lib/packages/packages.svelte'
  import UpgradeButton from '$lib/packages/upgrade-button.svelte'
  import type { StatusBadge } from '$lib/status'

  let { packages, entry }: { packages: Packages; entry: Entry } = $props()

  const { package: pkg, task } = $derived(entry)
  const output = $derived(task === undefined || task.status === 'queued' ? undefined : task.output)

  const badge = $derived.by((): StatusBadge | undefined => {
    if (packages.checking) return { label: 'Checking', variant: 'secondary' }

    if (pkg.state === 'pinned') return { label: 'Pinned', variant: 'secondary' }

    if (pkg.state === 'outdated') return { label: 'Upgrade available', variant: 'info' }

    if (task?.status === 'upgraded') return { label: 'Upgraded', variant: 'success' }

    return packages.listing?.status === 'checked'
      ? { label: 'Up to date', variant: 'success' }
      : undefined
  })
</script>

<Page title={pkg.name} actions={pkg.state === 'outdated' ? upgrade : undefined}>
  {#snippet subtitle()}
    {#if pkg.description}
      <p class="truncate text-muted-foreground">{pkg.description}</p>
    {/if}
  {/snippet}

  <MetaList>
    <dt>Installed</dt>
    <dd class="flex min-w-0 items-center gap-2">
      <span class="truncate font-mono text-xs select-text">{pkg.version}</span>
      {#if badge}
        <Badge variant={badge.variant}>{badge.label}</Badge>
      {/if}
    </dd>
    {#if pkg.latest !== pkg.version}
      <dt>Latest</dt>
      <dd class="truncate font-mono text-xs select-text">{pkg.latest}</dd>
    {/if}
    {#if pkg.tap}
      <dt>Tap</dt>
      <dd class="truncate font-mono text-xs select-text">{pkg.tap}</dd>
    {/if}
    {#if pkg.homepage}
      <dt>Homepage</dt>
      <dd class="-ml-2 flex font-mono">
        <Button variant="link" size="sm" href={pkg.homepage} target="_blank">{pkg.homepage}</Button>
      </dd>
    {/if}
  </MetaList>

  {#if task?.status === 'failed'}
    <FailureAlert title="Upgrade failed" message={task.message} />
  {/if}

  {#if output !== undefined}
    <Section title="Output">
      <div class="scroll-section" {@attach follow}>
        <div
          class="font-mono text-xs wrap-anywhere whitespace-pre-wrap text-foreground-secondary select-text"
        >
          {#each output.trimEnd().split('\n') as line, index (index)}
            <p class="min-h-lh">
              {#if line.startsWith('==> ')}
                <span class="text-info">==&gt;</span>
                <span class="text-foreground">{line.slice(4)}</span>
              {:else if line.startsWith('Error: ')}
                <span class="text-destructive">{line}</span>
              {:else}
                {line}
              {/if}
            </p>
          {/each}
        </div>
      </div>
    </Section>
  {/if}
</Page>

{#snippet upgrade()}
  <UpgradeButton {packages} {entry} variant="primary" />
{/snippet}
