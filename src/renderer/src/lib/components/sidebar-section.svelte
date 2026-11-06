<script lang="ts">
  import IconChevronRight from '@tabler/icons-svelte/icons/chevron-right'
  import type { Snippet } from 'svelte'
  import Toolbar from '$lib/components/toolbar.svelte'
  import * as Collapsible from '$lib/components/ui/collapsible'
  import * as Sidebar from '$lib/components/ui/sidebar'
  import { cn } from '$lib/utils'

  let {
    label,
    toolbar,
    children
  }: {
    label: string
    toolbar: Snippet
    children: Snippet
  } = $props()

  let open = $state(false)
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
        <Toolbar>
          {@render toolbar()}
        </Toolbar>
      </div>
      <Collapsible.Content hiddenUntilFound>
        {@render children()}
      </Collapsible.Content>
    </Sidebar.Group>
  {/snippet}
</Collapsible.Root>
