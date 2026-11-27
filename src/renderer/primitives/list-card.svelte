<script lang="ts">
  import type { Snippet } from 'svelte'
  import * as Card from './ui/card'
  import * as Item from './ui/item'

  let { title, children }: { title: string; children: Snippet } = $props()
</script>

<section class="mt-8 flex flex-col gap-2">
  <h2 class="truncate text-xs text-muted-foreground">{title}</h2>
  <Card.Root>
    <Card.Content>
      <Item.Group>{@render children()}</Item.Group>
    </Card.Content>
  </Card.Root>
</section>
