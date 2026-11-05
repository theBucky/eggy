<script lang="ts" module>
  export type Status = 'unknown' | 'running' | 'failed' | 'outdated' | 'updated' | 'current'

  const dots = {
    unknown: 'bg-muted-foreground/30',
    failed: 'bg-destructive',
    outdated: 'bg-info',
    updated: 'bg-success',
    current: 'bg-success'
  } satisfies Record<Exclude<Status, 'running'>, string>
</script>

<script lang="ts">
  import { Spinner } from '$lib/components/ui/spinner'

  let { status }: { status: Status } = $props()
</script>

<span class="flex size-4 shrink-0 items-center justify-center text-muted-foreground">
  {#if status === 'running'}
    <Spinner />
  {:else}
    <span class={['size-1.5 rounded-full', dots[status]]}></span>
  {/if}
</span>
