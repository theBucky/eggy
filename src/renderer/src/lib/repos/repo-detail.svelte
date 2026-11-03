<script lang="ts">
  import IconAlertCircle from '@tabler/icons-svelte/icons/alert-circle'
  import * as Alert from '$lib/components/ui/alert'
  import * as Avatar from '$lib/components/ui/avatar'
  import { Badge, type BadgeVariant } from '$lib/components/ui/badge'
  import { Button } from '$lib/components/ui/button'
  import * as Item from '$lib/components/ui/item'
  import { Spinner } from '$lib/components/ui/spinner'
  import { nameOf, tilde } from '$lib/paths'
  import { ago } from '$lib/time'
  import type { Entry, Workspace } from '$lib/repos/workspace.svelte'

  type SyncBadge = { label: string; variant: BadgeVariant }

  let { workspace, entry }: { workspace: Workspace; entry: Entry } = $props()

  const { repo, task } = $derived(entry)

  const badge = $derived.by((): SyncBadge => {
    if (task?.command === 'fetch' && task.status === 'running') {
      return { label: 'Checking', variant: 'secondary' }
    }

    if (repo.sync === undefined) return { label: 'Gone', variant: 'destructive' }

    const { ahead, behind } = repo.sync

    if (ahead === 0 && behind === 0) return { label: 'Up to date', variant: 'success' }

    return {
      label: [ahead > 0 && `${ahead} ahead`, behind > 0 && `${behind} behind`]
        .filter(Boolean)
        .join(', '),
      variant: behind > 0 ? 'brand' : 'secondary'
    }
  })
</script>

<!-- Keyed so switching repos starts each scroller at the top. -->
{#key repo.path}
  <div class="absolute inset-0 flex flex-col">
    <div class="scroll-fade-y my-2 flex min-h-0 flex-1 flex-col overflow-y-auto px-8 py-6">
      <div class="flex items-start justify-between gap-4">
        <div class="flex min-w-0 flex-col gap-1">
          <h1 class="truncate text-xl font-semibold tracking-tight">{nameOf(repo.path)}</h1>
          <p class="truncate font-mono text-xs text-muted-foreground">{tilde(repo.path)}</p>
        </div>
        <div class="[-webkit-app-region:no-drag]">
          <Button size="lg" disabled={workspace.busy} onclick={() => workspace.pull(entry)}>
            {#if task?.command === 'pull' && task.status === 'running'}
              <Spinner data-icon="inline-start" />
              Pulling
            {:else}
              Pull
            {/if}
          </Button>
        </div>
      </div>

      <dl class="mt-6 grid grid-cols-[96px_1fr] items-center gap-x-4 gap-y-2">
        <dt class="text-muted-foreground">Branch</dt>
        <dd class="truncate font-mono text-xs/[18px]">{repo.branch}</dd>
        <dt class="text-muted-foreground">Upstream</dt>
        <dd class="flex min-w-0 items-center gap-2">
          <span class="truncate font-mono text-xs/[18px]">{repo.upstream}</span>
          <Badge variant={badge.variant}>{badge.label}</Badge>
        </dd>
        <dt class="text-muted-foreground">Remote</dt>
        <dd class="truncate font-mono text-xs/[18px]">{repo.remote}</dd>
      </dl>

      {#if task?.status === 'failed'}
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

      {#if repo.history.length > 0}
        <section class="mt-8 flex min-h-0 flex-col">
          <h2 class="text-muted-foreground">Recent commits</h2>
          <!-- Bleeds into the page padding so the scrollbar and focus rings stay off the rows. -->
          <div class="scroll-fade-y -mx-scrollbar my-2 min-h-0 overflow-y-auto px-scrollbar py-1">
            <Item.Group>
              {#each repo.history as commit (commit.hash)}
                {@const link =
                  repo.commitUrl && !commit.unpushed
                    ? { href: repo.commitUrl + commit.hash, target: '_blank' }
                    : undefined}
                <div role="listitem" class={{ 'opacity-50': commit.unpushed }}>
                  <Item.Root size="xs">
                    {#snippet child({ props })}
                      <svelte:element this={link ? 'a' : 'div'} {...props} {...link}>
                        <Item.Media>
                          <Avatar.Root>
                            <Avatar.Fallback>
                              {commit.author.charAt(0).toUpperCase()}
                            </Avatar.Fallback>
                          </Avatar.Root>
                        </Item.Media>
                        <!-- The title's own clamp loses to its flex display and the description
                             allows two lines, so each line clamps itself. Wrapping anywhere keeps a
                             long word from widening the row past the panel. -->
                        <Item.Content>
                          <Item.Title>
                            <span class="line-clamp-1 wrap-anywhere">{commit.subject}</span>
                          </Item.Title>
                          <Item.Description>
                            <span class="line-clamp-1 wrap-anywhere">
                              <span class="font-mono">{commit.hash}</span>: {commit.author},
                              {ago(commit.date)}
                            </span>
                          </Item.Description>
                        </Item.Content>
                      </svelte:element>
                    {/snippet}
                  </Item.Root>
                </div>
              {/each}
            </Item.Group>
          </div>
        </section>
      {/if}
    </div>
  </div>
{/key}
