<script lang="ts">
  import type { Snippet } from 'svelte'

  let { title, actions, children }: { title: string; actions?: Snippet; children: Snippet } =
    $props()
</script>

<section class="mt-8 flex min-h-0 flex-col">
  <div class="flex h-9 shrink-0 items-center justify-between gap-4 border-b">
    <h2 class="truncate text-lg font-semibold">{title}</h2>
    {#if actions}
      <div class="flex gap-2 pr-2">{@render actions()}</div>
    {/if}
  </div>
  {@render children()}
</section>
