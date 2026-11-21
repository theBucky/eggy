<script lang="ts">
  import Page from '$lib/components/page.svelte'
  import * as Field from '$lib/components/ui/field'
  import * as Select from '$lib/components/ui/select'
  import { Switch } from '$lib/components/ui/switch'
  import type { Repos } from '$lib/repos/repos.svelte'
  import RootField from '$lib/repos/root-field.svelte'
  import type { Preferences } from '$lib/settings/preferences.svelte'
  import { THEMES, type Theme } from '$shared/theme'

  const LABELS: Record<Theme, string> = { system: 'System', light: 'Light', dark: 'Dark' }
  const items = THEMES.map((value) => ({ value, label: LABELS[value] }))

  let { repos, preferences }: { repos: Repos; preferences: Preferences } = $props()
</script>

<Page title="Settings">
  <section class="mt-8">
    <Field.Group>
      <RootField {repos} />
      <Field.Separator />
      <Field.Field orientation="horizontal">
        <Field.Content>
          <Field.Label for="check-on-launch">Check for upgrades on launch</Field.Label>
          <Field.Description>
            Check every application and package and fetch every repository as soon as the app opens.
          </Field.Description>
        </Field.Content>
        <Switch id="check-on-launch" bind:checked={preferences.checkOnLaunch} />
      </Field.Field>
      <Field.Separator />
      <Field.Field orientation="horizontal">
        <Field.Content>
          <Field.Label for="theme">Theme</Field.Label>
          <Field.Description>
            Follow the system appearance, or stay light or dark.
          </Field.Description>
        </Field.Content>
        <Select.Root
          type="single"
          {items}
          bind:value={
            () => preferences.theme,
            // SAFETY: the select offers only the values in `THEMES`.
            (value) => (preferences.theme = value as Theme)
          }
        >
          <Select.Trigger id="theme">
            <Select.Value />
          </Select.Trigger>
          <Select.Content align="end">
            {#each items as { value, label } (value)}
              <Select.Item {value} {label} />
            {/each}
          </Select.Content>
        </Select.Root>
      </Field.Field>
    </Field.Group>
  </section>
</Page>
