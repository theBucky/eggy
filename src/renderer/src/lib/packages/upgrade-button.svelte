<script lang="ts">
  import { Button, type ButtonProps } from '$lib/components/ui/button'
  import type { Entry, Packages } from '$lib/packages/packages.svelte'

  let {
    packages,
    entry,
    ...button
  }: { packages: Packages; entry: Entry } & Pick<ButtonProps, 'size' | 'variant'> = $props()
</script>

<Button {...button} disabled={packages.busy} onclick={() => packages.upgrade([entry])}>
  {entry.task?.status === 'running' ? 'Upgrading' : 'Upgrade'}
</Button>
