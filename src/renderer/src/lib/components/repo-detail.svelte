<script lang="ts">
  import { Button } from '$lib/components/ui/button'
  import { Spinner } from '$lib/components/ui/spinner'
  import { nameOf, tilde } from '$lib/paths'
  import { statusOf, type Entry } from '$lib/workspace.svelte'

  let { entry, disabled, onpull }: { entry: Entry; disabled: boolean; onpull: () => void } =
    $props()

  const { repo, task } = $derived(entry)

  const sync = $derived(
    repo.sync === undefined
      ? 'gone'
      : [
          repo.sync.ahead > 0 && `${repo.sync.ahead} ahead`,
          repo.sync.behind > 0 && `${repo.sync.behind} behind`
        ]
          .filter(Boolean)
          .join(', ') || 'up to date'
  )
</script>

<div class="absolute inset-0 flex flex-col">
  <div class="scroll-fade-y my-2 min-h-0 flex-1 overflow-y-auto px-8 py-6">
    <div class="flex items-start justify-between gap-4">
      <div class="flex min-w-0 flex-col gap-1">
        <h1 class="truncate text-xl font-semibold tracking-tight">{nameOf(repo.path)}</h1>
        <p class="truncate font-mono text-xs text-muted-foreground">{tilde(repo.path)}</p>
      </div>
      <div class="[-webkit-app-region:no-drag]">
        <Button size="lg" {disabled} onclick={onpull}>
          {#if task?.command === 'pull' && task.status === 'running'}
            <Spinner data-icon="inline-start" />
            Pulling
          {:else}
            Pull
          {/if}
        </Button>
      </div>
    </div>

    <dl class="mt-6 grid grid-cols-[96px_1fr] gap-x-4 gap-y-2">
      <dt class="text-muted-foreground">Branch</dt>
      <dd class="truncate font-mono text-xs/[18px]">{repo.branch}</dd>
      <dt class="text-muted-foreground">Upstream</dt>
      <dd class="truncate font-mono text-xs/[18px]">
        {repo.upstream}
        <span class="text-muted-foreground">· {sync}</span>
      </dd>
      <dt class="text-muted-foreground">Remote</dt>
      <dd class="truncate font-mono text-xs/[18px]">{repo.remote}</dd>
    </dl>

    {#if task}
      <section class="mt-8 divide-y rounded-xl border">
        <header class="flex h-9 items-center justify-between px-3.5 font-mono text-xs">
          <span class="text-foreground/75">
            {task.command === 'fetch' ? 'git fetch' : 'git pull --ff-only'}
          </span>
          <span class="flex text-muted-foreground">
            {#if task.status === 'running'}
              <Spinner />
            {:else if task.status === 'failed'}
              <span class="text-destructive">failed</span>
            {:else if task.status === 'updated'}
              <span class="text-success">+{task.commits.length}</span>
            {:else if statusOf(entry) === 'outdated'}
              <span class="text-brand">↓{repo.sync?.behind}</span>
            {:else}
              up to date
            {/if}
          </span>
        </header>
        {#if task.status === 'updated'}
          <ol class="py-3">
            {#each task.commits as commit (commit.hash)}
              <li class="flex items-baseline gap-3 px-3.5 leading-[22px]">
                <span class="shrink-0 font-mono text-xs text-muted-foreground/60">
                  {commit.hash}
                </span>
                <span class="min-w-0 flex-1 truncate">{commit.subject}</span>
                <span class="w-32 shrink-0 truncate text-xs text-muted-foreground">
                  {commit.author}
                </span>
                <span class="w-28 shrink-0 text-right text-xs text-muted-foreground">
                  {commit.date}
                </span>
              </li>
            {/each}
          </ol>
        {:else if task.status === 'failed'}
          <pre
            class="px-3.5 py-3 font-mono text-xs/[18px] wrap-break-word whitespace-pre-wrap">{task.message}</pre>
        {/if}
      </section>
    {/if}
  </div>
</div>
