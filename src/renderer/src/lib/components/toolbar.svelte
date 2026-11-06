<script lang="ts" module>
  import { Tooltip as TooltipPrimitive } from 'bits-ui'
  import { createContext } from 'svelte'

  // Buttons share one tooltip that hops between them, since swapping tooltips restyles the page.
  const [getTether, setTether] = createContext<TooltipPrimitive.Tether<string>>()

  export { getTether }
</script>

<script lang="ts">
  import type { Snippet } from 'svelte'
  import * as Tooltip from '$lib/components/ui/tooltip'

  let { children }: { children: Snippet } = $props()

  const tether = setTether(TooltipPrimitive.createTether<string>())
</script>

{@render children()}
<Tooltip.Root {tether}>
  {#snippet children({ payload })}
    <Tooltip.Content>{payload}</Tooltip.Content>
  {/snippet}
</Tooltip.Root>
