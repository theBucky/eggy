<script lang="ts">
  import { Button, type ButtonSize } from '$lib/components/ui/button'
  import type { Entry, Packages } from '$lib/packages/packages.svelte'

  let { packages, entry, size }: { packages: Packages; entry: Entry; size: ButtonSize } = $props()
</script>

<Button {size} disabled={packages.busy} onclick={() => packages.upgrade([entry])}>
  {entry.task?.status === 'running' ? 'Upgrading' : 'Upgrade'}
</Button>
