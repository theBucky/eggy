<script lang="ts">
  import { tilde } from '$client/paths'
  import { Button } from '$primitives/ui/button'
  import * as Field from '$primitives/ui/field'
  import type { Repos } from './repos.svelte'

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
