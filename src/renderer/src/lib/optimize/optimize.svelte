<script lang="ts">
  import { onMount } from 'svelte'
  import IconLock from '@tabler/icons-svelte/icons/lock'
  import ListCard from '$lib/components/list-card.svelte'
  import MetaList from '$lib/components/meta-list.svelte'
  import Page from '$lib/components/page.svelte'
  import { Button } from '$lib/components/ui/button'
  import * as Item from '$lib/components/ui/item'
  import { duration } from '$lib/format'
  import { CATALOG, GROUPS } from '$lib/optimize/catalog'
  import type { Optimizer } from '$lib/optimize/optimizer.svelte'
  import { list, plural } from '$shared/english'
  import {
    OPTIMIZATIONS,
    PRIVILEGED,
    isPrivileged,
    type Optimization,
    type OptimizeOutcome
  } from '$shared/optimize'

  const TONES: Partial<Record<OptimizeOutcome['status'], string>> = {
    attention: 'text-warning',
    failed: 'text-destructive'
  }

  const gibibytes = new Intl.NumberFormat('en', { maximumFractionDigits: 1 })
  const gigabytes = new Intl.NumberFormat('en', { maximumFractionDigits: 0 })

  let { optimizer }: { optimizer: Optimizer } = $props()

  onMount(() => {
    optimizer.inspect()
  })

  const tally = $derived(Map.groupBy(optimizer.outcomes, ({ status }) => status))

  function count(status: OptimizeOutcome['status']): number {
    return tally.get(status)?.length ?? 0
  }

  const headline = $derived.by(() => {
    if (optimizer.running) return 'Optimizing'

    const applied = count('applied')

    if (applied > 0) return `Applied ${plural(applied, 'optimization', 'optimizations')}`

    if (optimizer.outcomes.length === 0) return 'Not optimized yet'

    return optimizer.outcomes.every(
      ({ status }) => status === 'unchanged' || status === 'unavailable'
    )
      ? 'Nothing to optimize'
      : 'Nothing applied'
  })

  const summary = $derived.by(() => {
    if (optimizer.running) return `${optimizer.done} of ${optimizer.batch.length} done.`

    const counts = (
      ['unchanged', 'skipped', 'unavailable', 'failed', 'attention'] as const
    ).flatMap((status) => {
      const n = count(status)

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
      variant={optimizer.outcomes.length > 0 ? 'secondary' : 'primary'}
      disabled={optimizer.running}
      onclick={() => optimizer.optimize([...OPTIMIZATIONS])}
    >
      {#if optimizer.running}
        Optimizing
      {:else if optimizer.outcomes.length > 0}
        Optimize again
      {:else}
        Optimize
      {/if}
    </Button>
  {/snippet}

  {#if optimizer.machine}
    {@const { memory, disk, uptime } = optimizer.machine}
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
      <dd class="truncate">{duration(uptime)}</dd>
    </MetaList>
  {/if}

  {#each GROUPS as [group, optimizations] (group)}
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
        <Button onclick={() => window.api.invoke('review', outcome.review)}>Review</Button>
      {/if}
    </Item.Actions>
  </Item.Root>
{/snippet}
