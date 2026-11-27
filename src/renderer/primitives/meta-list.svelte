<script lang="ts">
  import type { Snippet } from 'svelte'

  let { children }: { children: Snippet } = $props()
</script>

<dl
  class="mt-6 grid auto-rows-6 grid-cols-[96px_1fr] items-center gap-x-4 gap-y-1 *:[dt]:text-muted-foreground"
>
  {@render children()}
</dl>
