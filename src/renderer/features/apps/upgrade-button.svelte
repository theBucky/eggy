<script lang="ts" module>
  import type { Progress } from '$shared/apps'

  const labels = {
    download: 'Downloading',
    install: 'Installing',
    waiting: 'Installing'
  } satisfies Record<Progress['stage'], string>
</script>

<script lang="ts">
  import { Button, type ButtonVariant } from '$primitives/ui/button'
  import { progressOf, type Apps, type Entry } from './apps.svelte'
  import './upgrade-button.css'

  let { apps, entry, variant }: { apps: Apps; entry: Entry; variant?: ButtonVariant } = $props()

  const progress = $derived(progressOf(entry))
</script>

<Button {variant} disabled={!apps.canUpgrade(entry)} onclick={() => apps.upgrade([entry])}>
  <span data-progress={progress && (progress.stage === 'download' ? progress.percent : 100)}>
    {progress ? labels[progress.stage] : 'Upgrade'}
  </span>
</Button>
