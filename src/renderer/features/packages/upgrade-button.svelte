<script lang="ts">
  import { Button, type ButtonVariant } from '$primitives/ui/button'
  import type { Entry, Packages } from './packages.svelte'

  let { packages, entry, variant }: { packages: Packages; entry: Entry; variant?: ButtonVariant } =
    $props()
</script>

<Button {variant} disabled={!packages.canUpgrade(entry)} onclick={() => packages.upgrade([entry])}>
  {#if entry.task?.status === 'queued'}
    Queued
  {:else if entry.task?.status === 'running'}
    Upgrading
  {:else}
    Upgrade
  {/if}
</Button>
