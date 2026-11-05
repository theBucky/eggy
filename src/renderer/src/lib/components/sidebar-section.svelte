<script lang="ts">
  import IconChevronRight from '@tabler/icons-svelte/icons/chevron-right'
  import { Tooltip as TooltipPrimitive } from 'bits-ui'
  import type { Snippet } from 'svelte'
  import * as Collapsible from '$lib/components/ui/collapsible'
  import * as Sidebar from '$lib/components/ui/sidebar'
  import * as Tooltip from '$lib/components/ui/tooltip'
  import { cn } from '$lib/utils'

  let {
    label,
    toolbar,
    children
  }: {
    label: string
    toolbar: Snippet<[TooltipPrimitive.Tether<string>]>
    children: Snippet
  } = $props()

  // One tooltip moves between the toolbar buttons instead of each mounting its own.
  const tether = TooltipPrimitive.createTether<string>()

  let open = $state(true)
</script>

<Collapsible.Root bind:open>
  {#snippet child({ props })}
    <Sidebar.Group {...props}>
      <div class="flex items-center gap-1">
        <Sidebar.GroupLabel class="flex-1">
          {#snippet child({ props })}
            <Collapsible.Trigger {...props}>
              {label}
              <IconChevronRight
                class={cn(
                  'transition-transform duration-collapsible ease-out-expo',
                  open && 'rotate-90'
                )}
              />
            </Collapsible.Trigger>
          {/snippet}
        </Sidebar.GroupLabel>
        {@render toolbar(tether)}
        <Tooltip.Root {tether}>
          {#snippet children({ payload })}
            <Tooltip.Content>{payload}</Tooltip.Content>
          {/snippet}
        </Tooltip.Root>
      </div>
      <Collapsible.Content hiddenUntilFound>
        {@render children()}
      </Collapsible.Content>
    </Sidebar.Group>
  {/snippet}
</Collapsible.Root>
