<script lang="ts">
  import type IconRefresh from '@tabler/icons-svelte/icons/refresh'
  import { Tooltip as TooltipPrimitive } from 'bits-ui'
  import { Button } from '$lib/components/ui/button'
  import { Spinner } from '$lib/components/ui/spinner'
  import * as Tooltip from '$lib/components/ui/tooltip'

  // Every tabler icon shares one type. Naming it through the package root would type-check every icon.
  type TablerIcon = typeof IconRefresh

  let {
    tether,
    label,
    icon: Icon,
    busy = false,
    disabled = false,
    onclick
  }: {
    tether: TooltipPrimitive.Tether<string>
    label: string
    icon: TablerIcon
    busy?: boolean
    disabled?: boolean
    onclick: () => void
  } = $props()
</script>

<Tooltip.Trigger {tether} payload={label}>
  {#snippet child({ props })}
    <Button {...props} variant="ghost" size="icon" aria-label={label} {disabled} {onclick}>
      {#if busy}
        <Spinner />
      {:else}
        <Icon stroke={1.5} />
      {/if}
    </Button>
  {/snippet}
</Tooltip.Trigger>
