<script lang="ts" module>
  import type { Optimization, OptimizeOutcome } from '$shared/api'

  type Group = 'Applications' | 'Finder' | 'Network' | 'System'

  const CATALOG: Record<Optimization, { group: Group; name: string; description: string }> = {
    savedStates: {
      group: 'Applications',
      name: 'Saved states',
      description: 'Move window states saved over 30 days ago to the Trash.'
    },
    preferences: {
      group: 'Applications',
      name: 'Preferences',
      description: 'Move preference files that no longer parse to the Trash.'
    },
    appDatabases: {
      group: 'Applications',
      name: 'App databases',
      description: 'Compact the Safari and Messages databases.'
    },
    loginItems: {
      group: 'Applications',
      name: 'Login items',
      description: 'Find login items whose apps are gone.'
    },
    launchAgents: {
      group: 'Applications',
      name: 'Launch agents',
      description: 'Find launch agents whose programs are gone.'
    },
    quickLook: {
      group: 'Finder',
      name: 'QuickLook',
      description: 'Reset QuickLook thumbnails and previews.'
    },
    sharedFileLists: {
      group: 'Finder',
      name: 'Favorites and recents',
      description: 'Move broken sidebar favorites and recent items lists to the Trash.'
    },
    networkVolumes: {
      group: 'Finder',
      name: 'Network volumes',
      description: 'Stop Finder writing .DS_Store files to network and USB volumes.'
    },
    dnsCache: { group: 'Network', name: 'DNS cache', description: 'Refresh the DNS cache.' },
    networkStack: {
      group: 'Network',
      name: 'Network stack',
      description: 'Flush the routing table and ARP cache when the network is down.'
    },
    spotlight: {
      group: 'System',
      name: 'Spotlight',
      description: 'Rebuild the index when searches stall.'
    },
    notifications: {
      group: 'System',
      name: 'Notifications',
      description: 'Clear notifications older than 30 days once their database passes 50 MB.'
    },
    quarantine: {
      group: 'System',
      name: 'Quarantine history',
      description: "Clear Gatekeeper's record of past downloads."
    }
  }

  const TONES = {
    applied: 'text-foreground',
    unchanged: 'text-muted-foreground',
    skipped: 'text-muted-foreground',
    unavailable: 'text-muted-foreground',
    attention: 'text-warn',
    failed: 'text-destructive'
  } satisfies Record<OptimizeOutcome['status'], string>
</script>

<script lang="ts">
  import { onMount } from 'svelte'
  import IconLock from '@tabler/icons-svelte/icons/lock'
  import StatusDot from '$lib/components/status-dot.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Table from '$lib/components/ui/table'
  import type { Optimizer } from '$lib/optimize/optimizer.svelte'
  import { duration } from '$lib/time'
  import { OPTIMIZATIONS, PRIVILEGED, isPrivileged } from '$shared/api'
  import { plural } from '$shared/plural'

  let { optimizer }: { optimizer: Optimizer } = $props()

  onMount(() => {
    optimizer.inspect()
  })

  const groups = Map.groupBy(OPTIMIZATIONS, (optimization) => CATALOG[optimization].group)

  const list = new Intl.ListFormat('en')
  const gibibytes = new Intl.NumberFormat('en', { maximumFractionDigits: 1 })
  const gigabytes = new Intl.NumberFormat('en', { maximumFractionDigits: 0 })

  const outcomes = $derived(
    OPTIMIZATIONS.flatMap((optimization) => optimizer.outcomeOf(optimization) ?? [])
  )

  const tally = $derived(Map.groupBy(outcomes, ({ status }) => status))

  const headline = $derived.by(() => {
    if (optimizer.running) return 'Optimizing'

    const applied = tally.get('applied')?.length ?? 0

    if (applied > 0) return `Applied ${plural(applied, 'optimization', 'optimizations')}`

    if (outcomes.length === 0) return 'Not optimized yet'

    return outcomes.every(({ status }) => status === 'unchanged' || status === 'unavailable')
      ? 'Nothing to optimize'
      : 'Nothing applied'
  })

  const subtitle = $derived.by(() => {
    if (optimizer.running) {
      const done = optimizer.batch.filter(
        (optimization) => optimizer.outcomeOf(optimization) !== undefined
      )

      return `${done.length} of ${optimizer.batch.length} done.`
    }

    const counts = (
      ['unchanged', 'skipped', 'unavailable', 'failed', 'attention'] as const
    ).flatMap((status) => {
      const n = tally.get(status)?.length ?? 0

      if (n === 0) return []

      return [
        status === 'attention' ? plural(n, 'needs attention', 'need attention') : `${n} ${status}`
      ]
    })

    if (counts.length > 0) return `${list.format(counts)}.`

    return `${OPTIMIZATIONS.length} tasks refresh caches, compact databases, and repair settings. ${PRIVILEGED.length} may ask for your password.`
  })
</script>

<div class="scroll-fade-y absolute inset-0 my-2 overflow-y-auto px-8 py-6">
  <div class="flex items-start justify-between gap-4">
    <div class="flex min-w-0 flex-col gap-1">
      <h1 class="truncate text-xl font-semibold tracking-tight">{headline}</h1>
      <p class="truncate text-muted-foreground">{subtitle}</p>
    </div>
    <div class="[-webkit-app-region:no-drag]">
      <Button
        size="pill"
        variant={outcomes.length > 0 ? 'secondary' : 'default'}
        disabled={optimizer.running}
        onclick={() => optimizer.optimize([...OPTIMIZATIONS])}
      >
        {#if optimizer.running}
          Optimizing
        {:else if outcomes.length > 0}
          Optimize again
        {:else}
          Optimize
        {/if}
      </Button>
    </div>
  </div>

  {#if optimizer.machine}
    {@const { memory, disk } = optimizer.machine}
    <dl class="mt-6 grid grid-cols-[96px_1fr] items-center gap-x-4 gap-y-2">
      <dt class="text-muted-foreground">Memory</dt>
      <dd class="truncate">
        {gibibytes.format(memory.used / 2 ** 30)} of {gibibytes.format(memory.total / 2 ** 30)} GB in
        use
      </dd>
      <dt class="text-muted-foreground">Disk</dt>
      <dd class="truncate">
        {gigabytes.format(disk.free / 1e9)} GB free of {gigabytes.format(disk.total / 1e9)} GB
      </dd>
      <dt class="text-muted-foreground">Uptime</dt>
      <dd class="truncate">{duration(optimizer.machine.uptime)}</dd>
    </dl>
  {/if}

  {#each groups as [group, optimizations] (group)}
    <section class="mt-8">
      <Table.Root>
        <colgroup>
          <col class="w-10" />
          <col class="w-48" />
          <col />
          <col class="w-32" />
        </colgroup>
        <Table.Header>
          <Table.Row>
            <Table.Head colspan={4}>{group}</Table.Head>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {#each optimizations as optimization (optimization)}
            {@render row(optimization)}
          {/each}
        </Table.Body>
      </Table.Root>
    </section>
  {/each}
</div>

<!-- Auto table layout widens a column to fit its content, so long text truncates inside a block
     that is zero wide until it stretches to the cell. -->
{#snippet row(optimization: Optimization)}
  {@const { name, description } = CATALOG[optimization]}
  {@const outcome = optimizer.outcomeOf(optimization)}
  {@const running = optimizer.states[optimization]?.status === 'running'}
  {@const pinned = outcome?.status === 'skipped' || outcome?.status === 'failed'}
  <Table.Row class="group">
    <Table.Cell>
      <div class="flex w-6 justify-center">
        <StatusDot status={optimizer.statusOf(optimization)} />
      </div>
    </Table.Cell>
    <Table.Cell>
      <div class="flex w-0 min-w-full items-center gap-1.5">
        <span class="truncate text-base">{name}</span>
        {#if isPrivileged(optimization)}
          <IconLock
            class="size-3.5 shrink-0 text-muted-foreground"
            aria-label="Needs an administrator"
          />
        {/if}
      </div>
    </Table.Cell>
    <Table.Cell>
      {#if outcome}
        <div class={['w-0 min-w-full truncate', TONES[outcome.status]]}>{outcome.message}</div>
      {:else}
        <div class="w-0 min-w-full truncate text-muted-foreground">{description}</div>
      {/if}
    </Table.Cell>
    <Table.Cell>
      <div class="flex justify-end gap-2">
        <!-- Hidden until hover unless a rerun is the next step, yet kept in the layout so a row holds
             its height as its state changes. -->
        <div
          class={[
            !pinned && 'opacity-0',
            !running && 'group-hover:opacity-100 has-focus-visible:opacity-100'
          ]}
        >
          <Button
            size="sm"
            disabled={optimizer.running}
            onclick={() => optimizer.optimize([optimization])}
          >
            Run
          </Button>
        </div>
        {#if outcome?.status === 'attention'}
          <Button size="sm" onclick={() => window.api.review(outcome.review)}>Review</Button>
        {/if}
      </div>
    </Table.Cell>
  </Table.Row>
{/snippet}
