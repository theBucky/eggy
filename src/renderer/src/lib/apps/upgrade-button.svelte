<script lang="ts">
  import { Button, type ButtonVariant } from '$lib/components/ui/button'
  import { progressOf, type Apps, type Entry } from '$lib/apps/apps.svelte'
  import './upgrade-button.css'

  let { apps, entry, variant }: { apps: Apps; entry: Entry; variant?: ButtonVariant } = $props()

  const progress = $derived(progressOf(entry))
</script>

<Button {variant} disabled={!apps.canUpgrade(entry)} onclick={() => apps.upgrade([entry])}>
  <span data-progress={progress?.stage === 'install' ? 100 : progress?.percent}>
    {#if progress?.stage === 'install'}
      Installing
    {:else if progress}
      Downloading
    {:else}
      Upgrade
    {/if}
  </span>
</Button>
