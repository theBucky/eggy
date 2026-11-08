<script lang="ts">
  import type IconRefresh from '@tabler/icons-svelte/icons/refresh'
  import { getTether } from '$lib/components/toolbar.svelte'
  import { Button } from '$lib/components/ui/button'
  import { Spinner } from '$lib/components/ui/spinner'
  import * as Tooltip from '$lib/components/ui/tooltip'

  // Every tabler icon shares one type. Naming it through the package root would type-check every icon.
  type TablerIcon = typeof IconRefresh

  let {
    label,
    icon: Icon,
    busy = false,
    disabled = false,
    onclick
  }: {
    label: string
    icon: TablerIcon
    busy?: boolean
    disabled?: boolean
    onclick: () => void
  } = $props()

  const tether = getTether()
</script>

<Tooltip.Trigger {tether} payload={label}>
  {#snippet child({ props })}
    <Button {...props} variant="ghost" size="icon" aria-label={label} {disabled} {onclick}>
      {#if busy}
        <Spinner />
      {:else}
        <Icon />
      {/if}
    </Button>
  {/snippet}
</Tooltip.Trigger>
