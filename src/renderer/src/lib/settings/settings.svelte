<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import * as Field from '$lib/components/ui/field'
  import { Switch } from '$lib/components/ui/switch'
  import { tilde } from '$lib/paths'
  import type { Workspace } from '$lib/repos/workspace.svelte'
  import type { Preferences } from '$lib/settings/preferences.svelte'

  let { workspace, preferences }: { workspace: Workspace; preferences: Preferences } = $props()
</script>

<div class="absolute inset-0 flex flex-col">
  <div class="scroll-fade-y my-2 flex min-h-0 flex-1 flex-col overflow-y-auto px-8 py-6">
    <h1 class="truncate text-xl font-semibold tracking-tight">Settings</h1>

    <section class="mt-8">
      <Field.Group>
        <Field.Field orientation="horizontal">
          <Field.Content>
            <Field.Title>Repository folder</Field.Title>
            <Field.Description>
              <span class="font-mono">{tilde(workspace.root)}</span>
            </Field.Description>
          </Field.Content>
          <Button
            variant="secondary"
            size="lg"
            disabled={workspace.busy}
            onclick={() => workspace.chooseRoot()}
          >
            Change
          </Button>
        </Field.Field>
        <Field.Separator />
        <Field.Field orientation="horizontal">
          <Field.Content>
            <Field.Label for="check-on-launch">Check for updates on launch</Field.Label>
            <Field.Description>
              Fetch every repository and check every application as soon as the app opens.
            </Field.Description>
          </Field.Content>
          <Switch id="check-on-launch" bind:checked={preferences.checkOnLaunch} />
        </Field.Field>
      </Field.Group>
    </section>
  </div>
</div>
