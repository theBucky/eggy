<script lang="ts">
  import type { Snippet } from 'svelte'

  // `shown` keeps the actions in view while they report a task's progress.
  let { shown = false, children }: { shown?: boolean; children: Snippet } = $props()
</script>

<!-- Faded rather than removed, so the row keeps its height. -->
<div
  class={[
    'flex justify-end gap-2',
    !shown && 'opacity-0 in-[tr:hover]:opacity-100 has-focus-visible:opacity-100'
  ]}
>
  {@render children()}
</div>
