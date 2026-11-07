<script lang="ts">
  import IconAlertCircle from '@tabler/icons-svelte/icons/alert-circle'
  import * as Alert from '$lib/components/ui/alert'

  let { title, message }: { title: string; message: string } = $props()
</script>

<Alert.Root variant="destructive">
  <IconAlertCircle />
  <Alert.Title>{title}</Alert.Title>
  <Alert.Description>
    <pre class="font-mono wrap-anywhere whitespace-pre-wrap select-text">{message}</pre>
  </Alert.Description>
</Alert.Root>
