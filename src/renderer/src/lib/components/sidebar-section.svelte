<script lang="ts">
  import IconChevronRight from '@tabler/icons-svelte/icons/chevron-right'
  import IconCloudDownload from '@tabler/icons-svelte/icons/cloud-download'
  import IconRefresh from '@tabler/icons-svelte/icons/refresh'
  import type { Snippet } from 'svelte'
  import ToolbarButton from '$lib/components/toolbar-button.svelte'
  import Toolbar from '$lib/components/toolbar.svelte'
  import * as Collapsible from '$lib/components/ui/collapsible'
  import * as Sidebar from '$lib/components/ui/sidebar'
  import type { Source } from '$lib/sources.svelte'
  import { cn } from '$lib/utils'

  let {
    label,
    source,
    checkLabel,
    upgradeVerb,
    children
  }: {
    label: string
    source: Source
    checkLabel: string
    upgradeVerb: string
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
          <ToolbarButton
            label={checkLabel}
            icon={IconRefresh}
            busy={source.checking}
            disabled={source.busy}
            onclick={() => source.refresh()}
          />
          <ToolbarButton
            label="{upgradeVerb} {source.outdated.length} outdated"
            icon={IconCloudDownload}
            busy={source.upgrading}
            disabled={source.busy || source.outdated.length === 0}
            onclick={() => source.upgradeOutdated()}
          />
        </Toolbar>
      </div>
      <Collapsible.Content hiddenUntilFound>
        <div class="pt-1">
          {@render children()}
        </div>
      </Collapsible.Content>
    </Sidebar.Group>
  {/snippet}
</Collapsible.Root>
