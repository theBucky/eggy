<script lang="ts">
  import * as AlertDialog from '$lib/components/ui/alert-dialog'
  import type { Apps } from '$lib/apps/apps.svelte'

  let { apps }: { apps: Apps } = $props()

  const list = new Intl.ListFormat('en')

  const names = $derived(list.format(apps.prompt.quitting.map(({ app }) => app.name)))
</script>

<AlertDialog.Root
  open={apps.prompt.open}
  onOpenChange={(open) => {
    if (!open) apps.cancel()
  }}
>
  <AlertDialog.Content>
    <div class="flex flex-wrap gap-2">
      {#each apps.prompt.quitting as { app } (app.path)}
        <img src={app.icon} alt="" class="size-10" />
      {/each}
    </div>
    <AlertDialog.Header>
      <AlertDialog.Title>
        {apps.prompt.quitting.length === 1
          ? `${names} is running`
          : `${apps.prompt.quitting.length} apps are running`}
      </AlertDialog.Title>
      <AlertDialog.Description>
        Updating force quits and reopens {names}, and unsaved changes are lost.
      </AlertDialog.Description>
    </AlertDialog.Header>
    <AlertDialog.Footer>
      <AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
      <AlertDialog.Action variant="destructive" onclick={() => apps.confirm()}>
        Quit and update
      </AlertDialog.Action>
    </AlertDialog.Footer>
  </AlertDialog.Content>
</AlertDialog.Root>
