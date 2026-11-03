<script lang="ts">
  import IconAlertCircle from '@tabler/icons-svelte/icons/alert-circle'
  import * as Alert from '$lib/components/ui/alert'
  import * as Avatar from '$lib/components/ui/avatar'
  import { Button } from '$lib/components/ui/button'
  import * as Item from '$lib/components/ui/item'
  import { Spinner } from '$lib/components/ui/spinner'
  import { nameOf, tilde } from '$lib/paths'
  import type { Entry } from '$lib/workspace.svelte'

  let { entry, disabled, onpull }: { entry: Entry; disabled: boolean; onpull: () => void } =
    $props()

  const { repo, task } = $derived(entry)

  const sync = $derived(
    task?.command === 'fetch' && task.status === 'running'
      ? 'checking'
      : repo.sync === undefined
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
  <div class="scroll-fade-y my-2 flex min-h-0 flex-1 flex-col overflow-y-auto px-8 py-6">
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

    {#if task?.status === 'updated'}
      <section class="mt-8 flex min-h-0 flex-col gap-2">
        <h2 class="text-muted-foreground">New commits</h2>
        <div class="flex min-h-0 flex-col rounded-xl border">
          <div class="scroll-fade-y my-2 min-h-0 overflow-y-auto px-1">
            <Item.Group>
              {#each task.commits as commit (commit.hash)}
                <Item.Root size="xs" role="listitem">
                  <Item.Media>
                    <Avatar.Root>
                      <Avatar.Fallback>{commit.author.charAt(0).toUpperCase()}</Avatar.Fallback>
                    </Avatar.Root>
                  </Item.Media>
                  <!-- The title's own clamp loses to its flex display and the description allows two
                       lines, so each line clamps itself. Wrapping anywhere keeps a long word from
                       widening the row past the card. -->
                  <Item.Content>
                    <Item.Title>
                      <span class="line-clamp-1 wrap-anywhere">{commit.subject}</span>
                    </Item.Title>
                    <Item.Description>
                      <span class="line-clamp-1 wrap-anywhere">
                        {commit.author} · {commit.date} ·
                        <span class="font-mono">{commit.hash}</span>
                      </span>
                    </Item.Description>
                  </Item.Content>
                </Item.Root>
              {/each}
            </Item.Group>
          </div>
        </div>
      </section>
    {:else if task?.status === 'failed'}
      <div class="mt-8">
        <Alert.Root variant="destructive">
          <IconAlertCircle />
          <Alert.Title>{task.command === 'fetch' ? 'Fetch failed' : 'Pull failed'}</Alert.Title>
          <Alert.Description>
            <pre class="font-mono wrap-anywhere whitespace-pre-wrap">{task.message}</pre>
          </Alert.Description>
        </Alert.Root>
      </div>
    {/if}
  </div>
</div>
