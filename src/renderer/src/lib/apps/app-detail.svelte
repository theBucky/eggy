<script lang="ts">
  import FailureAlert from '$lib/components/failure-alert.svelte'
  import { Badge, type BadgeVariant } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import { labelOf, megabytes, releaseOf, type Apps, type Entry } from '$lib/apps/apps.svelte'
  import ReleaseNotes from '$lib/apps/release-notes.svelte'
  import UpdateButton from '$lib/apps/update-button.svelte'
  import { nameOf, tilde } from '$lib/paths'
  import { ago } from '$lib/time'

  type StatusBadge = { label: string; variant: BadgeVariant }

  let { apps, entry }: { apps: Apps; entry: Entry } = $props()

  const { app, task } = $derived(entry)
  const update = $derived(releaseOf(entry))

  const feedLabel = $derived.by(() => {
    const { origin, pathname } = new URL(app.feed)

    return origin + pathname.split('/', 2).join('/')
  })

  const badge = $derived.by((): StatusBadge | undefined => {
    if (task?.command === 'check' && task.status === 'running') {
      return { label: 'Checking', variant: 'secondary' }
    }

    if (update !== undefined) return { label: 'Update available', variant: 'info' }

    if (task?.command === 'check' && task.status === 'failed') {
      return { label: 'Check failed', variant: 'destructive' }
    }

    if (task?.command === 'update' && task.status === 'updated') {
      return { label: 'Updated', variant: 'success' }
    }

    return task === undefined ? undefined : { label: 'Up to date', variant: 'success' }
  })
</script>

<div class="absolute inset-0 flex flex-col">
  <div class="scroll-fade-y my-2 flex min-h-0 flex-1 flex-col overflow-y-auto px-8 py-6">
    <div class="flex items-start justify-between gap-4">
      <div class="flex min-w-0 items-center gap-3">
        <img src={app.icon} alt="" class="size-12 shrink-0" />
        <div class="flex min-w-0 flex-col gap-1">
          <h1 class="truncate text-xl font-semibold tracking-tight">{app.name}</h1>
          <p class="truncate font-mono text-xs text-muted-foreground select-text">
            {tilde(app.path)}
          </p>
        </div>
      </div>
      {#if update}
        <div class="[-webkit-app-region:no-drag]">
          <UpdateButton {apps} {entry} size="pill" />
        </div>
      {/if}
    </div>

    <dl class="mt-6 grid grid-cols-[96px_1fr] items-center gap-x-4 gap-y-2">
      <dt class="text-muted-foreground">Installed</dt>
      <dd class="flex min-w-0 items-center gap-2">
        <span class="truncate font-mono text-xs/[18px] select-text">{labelOf(app)}</span>
        {#if badge}
          <Badge variant={badge.variant}>{badge.label}</Badge>
        {/if}
      </dd>
      {#if update}
        <dt class="text-muted-foreground">Latest</dt>
        <dd class="flex min-w-0 items-center gap-2">
          <span class="truncate font-mono text-xs/[18px] select-text">{labelOf(update)}</span>
          {#if update.date !== undefined}
            <span class="shrink-0 text-xs text-muted-foreground">{ago(update.date)}</span>
          {/if}
        </dd>
        <dt class="text-muted-foreground">Download</dt>
        <dd class="flex min-w-0 gap-2 font-mono text-xs/[18px]">
          <span class="truncate select-text"
            >{decodeURIComponent(nameOf(new URL(update.url).pathname))}</span
          >
          {#if update.size !== undefined}
            <span class="shrink-0 text-muted-foreground">{megabytes(update.size)}</span>
          {/if}
        </dd>
      {/if}
      <dt class="text-muted-foreground">Feed</dt>
      <dd class="-my-1 -ml-2 flex font-mono">
        <Button variant="link" size="sm" href={app.feed} target="_blank">{feedLabel}</Button>
      </dd>
    </dl>

    {#if task?.status === 'failed'}
      <div class="mt-8">
        <FailureAlert
          title={task.command === 'check' ? 'Check failed' : 'Update failed'}
          message={task.message}
        />
      </div>
    {/if}

    {#if update?.notes}
      <section class="mt-8 flex min-h-0 max-w-160 flex-col">
        <h2 class="text-muted-foreground">Release notes</h2>
        <div class="scroll-fade-y -mx-scrollbar my-2 min-h-0 overflow-y-auto px-scrollbar py-1">
          <ReleaseNotes notes={update.notes} />
        </div>
      </section>
    {/if}
  </div>
</div>
