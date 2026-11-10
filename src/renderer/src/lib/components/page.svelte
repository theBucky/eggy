<script lang="ts">
  import type { Snippet } from 'svelte'

  let {
    title,
    icon,
    subtitle,
    actions,
    children
  }: {
    title: string
    icon?: string
    subtitle?: Snippet
    actions?: Snippet
    children: Snippet
  } = $props()
</script>

<div class="scroll-fade-y absolute inset-0 my-2 flex flex-col overflow-y-auto px-8 py-6">
  <div class="flex items-start justify-between gap-4">
    <div class="flex min-w-0 items-center gap-3">
      {#if icon}
        <img src={icon} alt="" class="size-12 shrink-0" />
      {/if}
      <div class="flex min-w-0 flex-col gap-1">
        <h1 class="truncate text-xl font-semibold tracking-tight">{title}</h1>
        {@render subtitle?.()}
      </div>
    </div>
    {#if actions}
      <div class="flex gap-2">{@render actions()}</div>
    {/if}
  </div>

  {@render children()}
</div>
