<script lang="ts">
  import { CodeView, parsePatchFiles, type CodeViewDiffItem } from '@pierre/diffs'
  import IconArrowsMoveVertical from '@tabler/icons-svelte/icons/arrows-move-vertical'
  import IconExternalLink from '@tabler/icons-svelte/icons/external-link'
  import IconFold from '@tabler/icons-svelte/icons/fold'
  import IconX from '@tabler/icons-svelte/icons/x'
  import { mount, unmount } from 'svelte'
  import { SvelteSet } from 'svelte/reactivity'
  import Toolbar from '$lib/components/toolbar.svelte'
  import ToolbarButton from '$lib/components/toolbar-button.svelte'
  import { DIFF_THEME, highlighter } from '$lib/repos/highlighter'
  import FileHeader, { HEADER_HEIGHT } from '$lib/repos/file-header.svelte'
  import { ago } from '$lib/time'
  import type { Commit } from '$shared/api'

  type Detail = { commit: Commit; body: string; items: CodeViewDiffItem[] }

  const LINE_HEIGHT = 20

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

  // The viewer asks for a file's header on every render of it, so each file mounts its header once.
  const headers = new Map<string, { host: HTMLElement; header: ReturnType<typeof mount> }>()

  // A switch keeps the last commit on screen until the next one is ready to replace it whole.
  const shown = $derived(detail?.commit ?? commit)
  const rendered = $derived(revealed ? detail : undefined)
  const allCollapsed = $derived(expanded.size === 0)

  const totals = $derived.by(() => {
    if (detail === undefined) return undefined

    const hunks = detail.items.flatMap(({ fileDiff }) => fileDiff.hunks)

    return {
      files: detail.items.length,
      additions: hunks.reduce((sum, hunk) => sum + hunk.additionLines, 0),
      deletions: hunks.reduce((sum, hunk) => sum + hunk.deletionLines, 0)
    }
  })

  const viewer = new CodeView(
    {
      theme: DIFF_THEME,
      themeType: 'light',
      diffStyle: 'unified',
      diffIndicators: 'none',
      hunkSeparators: 'metadata',
      overflow: 'wrap',
      stickyHeaders: true,
      layout: { paddingTop: 0, paddingBottom: 0, gap: 0 },
      itemMetrics: {
        lineHeight: LINE_HEIGHT,
        diffHeaderHeight: HEADER_HEIGHT,
        hunkSeparatorHeight: LINE_HEIGHT
      },
      // Colors come from the design system's light editor palette. Changed lines take their colors
      // as is, where the viewer would tint the background with them, and run them unbroken through
      // the gutter. A pinned header tucks its top border under the pane header's, which would
      // otherwise double it.
      unsafeCSS: `
      :host {
        --diffs-font-family: var(--font-mono);
        --diffs-header-font-family: var(--font-mono);
        --diffs-font-size: 12px;
        --diffs-line-height: ${LINE_HEIGHT}px;
        --diffs-addition-color-override: var(--success);
        --diffs-deletion-color-override: var(--destructive);
        --diffs-bg-addition-override: #14c16f24;
        --diffs-bg-addition-number-override: #14c16f24;
        --diffs-bg-deletion-override: #fb2b3e38;
        --diffs-bg-deletion-number-override: #fb2b3e38;
        --diffs-fg-number-override: #1c1c1c5c;
        --diffs-bg-separator-override: #1c1c1c0a;
      }
      [data-line-type^='change'] {
        --mix-light: 0%;
      }
      [data-column-number] {
        border-right-color: transparent;
      }
      [data-separator='metadata'] {
        height: ${LINE_HEIGHT}px;
      }
      [data-separator='metadata'] [data-separator-wrapper] {
        background-color: transparent;
        color: var(--muted-foreground);
        font-size: 12px;
        line-height: 16px;
      }
      [data-diffs-header][data-sticky] {
        top: -1px;
      }
    `,
      renderCodeViewHeader: () => summary,
      // Every item is a diff, though the callback serves file items too.
      renderCustomHeader: (_, { item }) => (item.type === 'diff' ? header(item) : undefined)
    },
    highlighter
  )

  function header({ id, fileDiff }: CodeViewDiffItem): HTMLElement {
    let entry = headers.get(id)

    if (entry === undefined) {
      const host = document.createElement('div')

      entry = {
        host,
        header: mount(FileHeader, {
          target: host,
          props: {
            fileDiff,
            get open() {
              return expanded.has(id)
            },
            ontoggle: (open) => toggle(id, host, open)
          }
        })
      }
      headers.set(id, entry)
    }

    return entry.host
  }

  // Folding a file from its pinned header would carry the header off the top, so the view first
  // moves to where the file starts. The extra pixel tucks the header's top border under the pane's.
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

    window.api.show(path, current.hash).then(({ body, patch }) => {
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

  // Rendering waits for the pane to come to rest, so the slide never stalls on it.
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
      <span class="font-mono">{shown.hash}</span>
      {#if totals}
        <span class="truncate text-muted-foreground">
          {totals.files}
          {totals.files === 1 ? 'file' : 'files'}
        </span>
        <span class="flex gap-2 font-mono text-xs">
          <span class="text-success">+{totals.additions}</span>
          <span class="text-destructive">-{totals.deletions}</span>
        </span>
      {/if}
    </div>
    <div class="flex items-center gap-1 [-webkit-app-region:no-drag]">
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

  <!-- The viewer moves the summary into the scroll content, above the first file. -->
  <div bind:this={root} class="mb-2 min-h-0 flex-1 overflow-y-auto">
    <div bind:this={summary} class="flex flex-col gap-2 p-5">
      <h2 class="text-lg font-semibold tracking-tight wrap-anywhere">{shown.subject}</h2>
      {#if detail?.body}
        <p class="whitespace-pre-wrap text-foreground/74 wrap-anywhere">{detail.body}</p>
      {/if}
      <p class="flex gap-2 pt-1 text-xs">
        <span class="text-foreground/74">{shown.author}</span>
        <span class="text-muted-foreground">committed {ago(shown.date)}</span>
      </p>
    </div>
  </div>
</section>
