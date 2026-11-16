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

  const TONES: Partial<Record<OptimizeOutcome['status'], string>> = {
    attention: 'text-warning',
    failed: 'text-destructive'
  }
</script>

<script lang="ts">
  import { onMount } from 'svelte'
  import IconLock from '@tabler/icons-svelte/icons/lock'
  import ListCard from '$lib/components/list-card.svelte'
  import MetaList from '$lib/components/meta-list.svelte'
  import Page from '$lib/components/page.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Item from '$lib/components/ui/item'
  import type { Optimizer } from '$lib/optimize/optimizer.svelte'
  import { duration, list } from '$lib/format'
  import { OPTIMIZATIONS, PRIVILEGED, isPrivileged } from '$shared/api'
  import { plural } from '$shared/plural'

  let { optimizer }: { optimizer: Optimizer } = $props()

  onMount(() => {
    optimizer.inspect()
  })

  const groups = Map.groupBy(OPTIMIZATIONS, (optimization) => CATALOG[optimization].group)

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

  const summary = $derived.by(() => {
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

<Page title={headline}>
  {#snippet subtitle()}
    <p class="truncate text-muted-foreground">{summary}</p>
  {/snippet}

  {#snippet actions()}
    <Button
      variant={outcomes.length > 0 ? 'secondary' : 'primary'}
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
  {/snippet}

  {#if optimizer.machine}
    {@const { memory, disk } = optimizer.machine}
    <MetaList>
      <dt>Memory</dt>
      <dd class="truncate">
        {gibibytes.format(memory.used / 2 ** 30)} of {gibibytes.format(memory.total / 2 ** 30)} GB in
        use
      </dd>
      <dt>Disk</dt>
      <dd class="truncate">
        {gigabytes.format(disk.free / 1e9)} GB free of {gigabytes.format(disk.total / 1e9)} GB
      </dd>
      <dt>Uptime</dt>
      <dd class="truncate">{duration(optimizer.machine.uptime)}</dd>
    </MetaList>
  {/if}

  {#each groups as [group, optimizations] (group)}
    <ListCard title={group}>
      {#each optimizations as optimization, index (optimization)}
        {#if index > 0}<Item.Separator decorative />{/if}
        {@render row(optimization)}
      {/each}
    </ListCard>
  {/each}
</Page>

{#snippet row(optimization: Optimization)}
  {@const { name, description } = CATALOG[optimization]}
  {@const outcome = optimizer.outcomeOf(optimization)}
  <Item.Root size="xs" role="listitem">
    <Item.Content>
      <Item.Title>
        <span class="line-clamp-1">{name}</span>
        {#if isPrivileged(optimization)}
          <IconLock
            class="size-3.5 shrink-0 text-muted-foreground"
            aria-label="Needs an administrator"
          />
        {/if}
      </Item.Title>
      <Item.Description>
        {#if outcome}
          <span class={TONES[outcome.status]}>{outcome.message}</span>
        {:else}
          {description}
        {/if}
      </Item.Description>
    </Item.Content>
    <Item.Actions>
      <Button disabled={optimizer.running} onclick={() => optimizer.optimize([optimization])}>
        {optimizer.isRunning(optimization) ? 'Running' : 'Run'}
      </Button>
      {#if outcome?.status === 'attention'}
        <Button onclick={() => window.api.review(outcome.review)}>Review</Button>
      {/if}
    </Item.Actions>
  </Item.Root>
{/snippet}
