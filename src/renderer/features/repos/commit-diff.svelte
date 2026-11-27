<script lang="ts">
  import { parsePatchFiles, type CodeViewDiffItem } from '@pierre/diffs'
  import IconArrowsMoveVertical from '@tabler/icons-svelte/icons/arrows-move-vertical'
  import IconExternalLink from '@tabler/icons-svelte/icons/external-link'
  import IconFold from '@tabler/icons-svelte/icons/fold'
  import IconX from '@tabler/icons-svelte/icons/x'
  import { mount, unmount } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import { invoke } from '$client/api'
  import { ago } from '$primitives/format'
  import ToolbarButton from '$primitives/toolbar-button.svelte'
  import Toolbar from '$primitives/toolbar.svelte'
  import { plural } from '$shared/english'
  import type { Commit } from '$shared/repos'
  import { changesOf, createViewer } from './diff-viewer'
  import FileHeader from './file-header.svelte'

  type Detail = { commit: Commit; body: string; items: CodeViewDiffItem[] }

  let {
    path,
    commit,
    revealed,
    onclose
  }: {
    path: string
    commit: Commit
    revealed: boolean
    onclose: () => void
  } = $props()

  let root: HTMLElement
  let summary: HTMLElement

  // Raw, since the viewer keys its render state on each diff's identity.
  let detail = $state.raw<Detail>()

  const expanded = new SvelteSet<string>()

  const headers = new Map<string, { host: HTMLElement; header: ReturnType<typeof mount> }>()

  const shown = $derived(detail?.commit ?? commit)
  const allCollapsed = $derived(expanded.size === 0)

  const rendered = $derived(revealed ? detail : undefined)

  const totals = $derived(
    detail && {
      files: detail.items.length,
      ...changesOf(detail.items.flatMap(({ fileDiff }) => fileDiff.hunks))
    }
  )

  const viewer = createViewer({
    renderCodeViewHeader: () => summary,
    renderCustomHeader: (_, { item }) => (item.type === 'diff' ? headerOf(item) : undefined)
  })

  function headerOf({ id, fileDiff }: CodeViewDiffItem): HTMLElement {
    const mounted = headers.get(id)

    if (mounted !== undefined) return mounted.host

    const host = document.createElement('div')

    const header = mount(FileHeader, {
      target: host,
      props: {
        fileDiff,
        get open() {
          return expanded.has(id)
        },
        ontoggle: (open) => toggle(id, host, open)
      }
    })

    headers.set(id, { host, header })

    return host
  }

  function toggle(id: string, host: HTMLElement, open: boolean): void {
    if (open) {
      expanded.add(id)

      return
    }

    const top = host.closest('diffs-container')!.getBoundingClientRect().top

    if (top < root.getBoundingClientRect().top) viewer.scrollTo({ type: 'item', id, offset: -1 })

    expanded.delete(id)
  }

  function unmountHeaders(): void {
    for (const { header } of headers.values()) unmount(header)

    headers.clear()
  }

  $effect(() => {
    viewer.setup(root)

    return () => {
      viewer.cleanUp()
      unmountHeaders()
    }
  })

  $effect(() => {
    const current = commit
    let live = true

    invoke('showCommit', path, current.hash).then(({ body, patch }) => {
      if (!live) return

      const files = parsePatchFiles(patch, { cacheKeyPrefix: `${path}:${current.hash}` }).flatMap(
        (parsed) => parsed.files
      )

      unmountHeaders()
      expanded.clear()
      detail = {
        commit: current,
        body,
        // A file whose type changes comes as a deletion and an addition under one name.
        items: files.map((fileDiff, index) => ({
          id: `${current.hash}:${index}`,
          type: 'diff',
          fileDiff
        }))
      }
      viewer.scrollTo({ type: 'position', position: 0 })
    })

    return () => {
      live = false
    }
  })

  $effect(() => {
    if (!rendered) return

    viewer.setItems(
      rendered.items.map((item) => {
        const open = expanded.has(item.id)

        return { ...item, collapsed: !open, version: Number(open) }
      })
    )
  })

  function toggleAll(items: CodeViewDiffItem[]): void {
    if (allCollapsed) for (const { id } of items) expanded.add(id)
    else expanded.clear()
  }
</script>

<section class={['flex size-full flex-col transition-opacity', !rendered && 'opacity-0']}>
  <header class="flex h-12 shrink-0 items-center justify-between gap-3 border-b pr-3 pl-5">
    <div class="flex min-w-0 items-center gap-3">
      <span class="font-mono text-xs select-text">{shown.hash}</span>
      {#if totals}
        <span class="truncate text-muted-foreground">{plural(totals.files, 'file', 'files')}</span>
        <span class="flex gap-2 font-mono text-xs">
          <span class="text-added">+{totals.additions}</span>
          <span class="text-removed">-{totals.deletions}</span>
        </span>
      {/if}
    </div>
    <div class="flex items-center gap-1">
      <Toolbar>
        {#if detail?.items.length}
          {@const items = detail.items}
          <ToolbarButton
            label={allCollapsed ? 'Expand all files' : 'Collapse all files'}
            icon={allCollapsed ? IconArrowsMoveVertical : IconFold}
            onclick={() => toggleAll(items)}
          />
        {/if}
        {#if detail?.commit.url}
          {@const url = detail.commit.url}
          <ToolbarButton
            label="Open in upstream"
            icon={IconExternalLink}
            onclick={() => window.open(url)}
          />
        {/if}
        <ToolbarButton label="Close" icon={IconX} onclick={onclose} />
      </Toolbar>
    </div>
  </header>

  <div bind:this={root} class="mb-2 flex-1 overflow-y-auto select-text">
    <div bind:this={summary} class="flex flex-col gap-2 p-5 wrap-anywhere">
      <h2 class="text-lg font-semibold">{shown.subject}</h2>
      {#if detail?.body}
        <p class="whitespace-pre-wrap text-foreground-secondary">{detail.body}</p>
      {/if}
      <p class="flex gap-2 pt-1 text-xs">
        <span class="text-foreground-secondary">{shown.author}</span>
        <span class="text-muted-foreground">committed {ago(shown.date)}</span>
      </p>
    </div>
  </div>
</section>
