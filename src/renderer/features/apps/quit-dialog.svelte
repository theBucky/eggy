<script lang="ts">
  import * as AlertDialog from '$primitives/ui/alert-dialog'
  import { list } from '$shared/english'
  import type { QuitPrompt } from './quit-prompt.svelte'

  let { prompt }: { prompt: QuitPrompt } = $props()

  const names = $derived(list.format(prompt.apps.map(({ name }) => name)))
</script>

<AlertDialog.Root
  open={prompt.open}
  onOpenChange={(open) => {
    if (!open) prompt.answer(false)
  }}
>
  <AlertDialog.Content>
    <div class="flex flex-wrap gap-2">
      {#each prompt.apps as app (app.path)}
        <img src={app.icon} alt="" class="size-10" />
      {/each}
    </div>
    <AlertDialog.Header>
      <AlertDialog.Title>
        {prompt.apps.length === 1
          ? `${names} is running`
          : `${prompt.apps.length} apps are running`}
      </AlertDialog.Title>
      <AlertDialog.Description>
        Upgrading force quits and reopens {names}, and unsaved changes are lost.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action variant="destructive" onclick={() => prompt.answer(true)}>
        Quit and upgrade
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
