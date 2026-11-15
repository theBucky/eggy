<script lang="ts">
  import type { Snippet } from 'svelte'
  import type { ClassValue } from 'svelte/elements'

  let {
    title,
    class: className,
    actions,
    children
  }: { title: string; class?: ClassValue; actions?: Snippet; children: Snippet } = $props()
</script>

<section class={['mt-8 flex flex-col', className]}>
  <div class="flex h-9 shrink-0 items-center justify-between gap-4 border-b">
    <h2 class="truncate text-lg font-semibold">{title}</h2>
    {#if actions}
      <div class="flex gap-2 pr-2">{@render actions()}</div>
    {/if}
  </div>
  {@render children()}
</section>
