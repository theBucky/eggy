<script lang="ts">
  import { Button, type ButtonProps } from '$lib/components/ui/button'
  import type { Entry, Packages } from '$lib/packages/packages.svelte'

  let {
    packages,
    entry,
    ...button
  }: { packages: Packages; entry: Entry } & Pick<ButtonProps, 'size' | 'variant'> = $props()
</script>

<Button
  {...button}
  disabled={!packages.canUpgrade(entry)}
  onclick={() => packages.upgrade([entry])}
>
  {#if entry.task?.status === 'queued'}
    Queued
  {:else if entry.task?.status === 'running'}
    Upgrading
  {:else}
    Upgrade
  {/if}
</Button>
