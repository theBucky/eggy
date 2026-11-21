<script lang="ts">
  import IconAlertCircle from '@tabler/icons-svelte/icons/alert-circle'
  import * as Alert from '$lib/components/ui/alert'

  let { title, message }: { title: string; message: string } = $props()
</script>

<div class="mt-8">
  <Alert.Root variant="destructive">
    <IconAlertCircle />
    <Alert.Title>{title}</Alert.Title>
    <Alert.Description>
      <p class="wrap-anywhere whitespace-pre-wrap select-text">{message}</p>
    </Alert.Description>
  </Alert.Root>
</div>
