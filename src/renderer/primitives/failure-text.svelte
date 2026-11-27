<script lang="ts">
  let { message }: { message: string } = $props()
</script>

<span class="block truncate-fade text-destructive">{message}</span>
