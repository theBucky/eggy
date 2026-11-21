<script lang="ts">
  import type { Snippet } from 'svelte'
  import * as Item from '$lib/components/ui/item'

  let { children }: { children: Snippet } = $props()
</script>

<Item.Root size="xs" role="listitem">
  <Item.Content>
    <Item.Description>
      {@render children()}
    </Item.Description>
  </Item.Content>
</Item.Root>
