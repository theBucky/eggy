<script lang="ts" module>
  import type { Status } from './status'

  const dots = {
    unknown: 'bg-placeholder',
    failed: 'bg-destructive',
    outdated: 'bg-info',
    current: 'bg-success'
  } satisfies Record<Exclude<Status, 'running'>, string>
</script>

<script lang="ts">
  import { Spinner } from '$primitives/ui/spinner'

  let { status }: { status: Status } = $props()
</script>

<span class="flex size-3.5 shrink-0 items-center justify-center text-muted-foreground">
  {#if status === 'running'}
    <Spinner />
  {:else}
    <span class={['size-1.5 rounded-full', dots[status]]}></span>
  {/if}
</span>
