<script lang="ts">
  import { on } from 'svelte/events'
  import FailureAlert from '$lib/components/failure-alert.svelte'
  import { Badge, type BadgeVariant } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import type { Entry, Packages } from '$lib/packages/packages.svelte'
  import UpgradeButton from '$lib/packages/upgrade-button.svelte'

  type StatusBadge = { label: string; variant: BadgeVariant }

  let { packages, entry }: { packages: Packages; entry: Entry } = $props()

  const { package: pkg, task } = $derived(entry)
  const lines = $derived(task?.output.trimEnd().split('\n') ?? [])

  const badge = $derived.by((): StatusBadge | undefined => {
    if (packages.check?.status === 'running') return { label: 'Checking', variant: 'secondary' }

    if (pkg.pinned) return { label: 'Pinned', variant: 'secondary' }

    if (pkg.outdated) return { label: 'Upgrade available', variant: 'info' }

    if (task?.status === 'upgraded') return { label: 'Upgraded', variant: 'success' }

    return packages.check?.status === 'checked'
      ? { label: 'Up to date', variant: 'success' }
      : undefined
  })

  // Keeps new output in view until the reader scrolls back up.
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

<div class="scroll-fade-y absolute inset-0 my-2 flex flex-col overflow-y-auto px-8 py-6">
  <div class="flex items-start justify-between gap-4">
    <div class="flex min-w-0 flex-col gap-1">
      <h1 class="truncate text-xl font-semibold tracking-tight">{pkg.name}</h1>
      {#if pkg.description}
        <p class="truncate text-muted-foreground">{pkg.description}</p>
      {/if}
    </div>
    {#if pkg.outdated || task?.status === 'running'}
      <div class="[-webkit-app-region:no-drag]">
        <UpgradeButton {packages} {entry} size="pill" />
      </div>
    {/if}
  </div>

  <dl class="mt-6 grid grid-cols-[96px_1fr] items-center gap-x-4 gap-y-2">
    <dt class="text-muted-foreground">Installed</dt>
    <dd class="flex min-w-0 items-center gap-2">
      <span class="truncate font-mono text-xs/[18px] select-text">{pkg.version}</span>
      {#if badge}
        <Badge variant={badge.variant}>{badge.label}</Badge>
      {/if}
    </dd>
    {#if pkg.latest !== pkg.version}
      <dt class="text-muted-foreground">Latest</dt>
      <dd class="truncate font-mono text-xs/[18px] select-text">{pkg.latest}</dd>
    {/if}
    {#if pkg.tap}
      <dt class="text-muted-foreground">Tap</dt>
      <dd class="truncate font-mono text-xs/[18px] select-text">{pkg.tap}</dd>
    {/if}
    {#if pkg.homepage}
      <dt class="text-muted-foreground">Homepage</dt>
      <dd class="-my-1 -ml-2 flex font-mono">
        <Button variant="link" size="sm" href={pkg.homepage} target="_blank">{pkg.homepage}</Button>
      </dd>
    {/if}
  </dl>

  {#if task?.status === 'failed'}
    <div class="mt-8">
      <FailureAlert title="Upgrade failed" message={task.message} />
    </div>
  {/if}

  {#if task}
    <section class="mt-8 flex min-h-0 max-w-160 flex-col">
      <h2 class="text-muted-foreground">Output</h2>
      <div
        class="scroll-fade-y -mx-scrollbar my-2 overflow-y-auto px-scrollbar py-1"
        {@attach follow}
      >
        <div
          class="font-mono text-xs/[18px] wrap-anywhere whitespace-pre-wrap text-foreground/74 select-text"
        >
          {#each lines as line, index (index)}
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
    </section>
  {/if}
</div>
