<script lang="ts">
  import ListNote from '$lib/components/list-note.svelte'
  import type { Source } from '$lib/source.svelte'

  let { source, empty }: { source: Source; empty: string } = $props()
</script>

<ListNote>
  {#if source.entries.length === 0}
    {empty}
  {:else}
    {source.checked ? 'Up to date.' : 'Not checked.'}
  {/if}
</ListNote>
