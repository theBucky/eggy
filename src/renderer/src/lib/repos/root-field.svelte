<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import * as Field from '$lib/components/ui/field'
  import { tilde } from '$lib/paths'
  import type { Repos } from '$lib/repos/repos.svelte'

  let { repos }: { repos: Repos } = $props()
</script>

<Field.Field orientation="horizontal">
  <Field.Content>
    <Field.Title>Repository folder</Field.Title>
    <Field.Description>
      <span class="font-mono select-text">{tilde(repos.root)}</span>
    </Field.Description>
  </Field.Content>
  <Button disabled={repos.busy} onclick={() => repos.chooseRoot()}>Change</Button>
</Field.Field>
