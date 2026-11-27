import { CodeView, registerCustomTheme, type CodeViewOptions, type Hunk } from '@pierre/diffs'
import { WorkerPoolManager } from '@pierre/diffs/worker'
import HighlightWorker from '@pierre/diffs/worker/worker-portable.js?worker'

type Palette = {
  background: string
  foreground: string
  comment: string
  keyword: string
  string: string
  function: string
  number: string
  constant: string
  link: string
}

type Changes = { additions: number; deletions: number }

export const HEADER_HEIGHT = 36
const LINE_HEIGHT = 20

const themes = { light: 'app-light', dark: 'app-dark' }

function register(type: keyof typeof themes, palette: Palette): void {
  const name = themes[type]

  registerCustomTheme(name, async () => ({
    name,
    type,
    colors: {
      'editor.background': palette.background,
      'editor.foreground': palette.foreground
    },
    tokenColors: [
      {
        scope: ['comment', 'punctuation.definition.comment', 'string.quoted.docstring'],
        settings: { foreground: palette.comment }
      },
      {
        scope: [
          'keyword',
          'storage',
          'keyword.operator.new',
          'keyword.operator.expression',
          'entity.name.tag'
        ],
        settings: { foreground: palette.keyword }
      },
      { scope: ['keyword.operator', 'punctuation'], settings: { foreground: palette.foreground } },
      {
        scope: ['string', 'punctuation.definition.string', 'string.regexp'],
        settings: { foreground: palette.string }
      },
      {
        scope: ['entity.name.function', 'support.function', 'entity.other.attribute-name'],
        settings: { foreground: palette.function }
      },
      { scope: ['constant.numeric'], settings: { foreground: palette.number } },
      {
        scope: [
          'constant.language',
          'constant.character',
          'constant.other',
          'support.constant',
          'entity.name.type',
          'entity.name.class',
          'entity.other.inherited-class',
          'support.type',
          'support.class'
        ],
        settings: { foreground: palette.constant }
      },
      {
        scope: ['markup.underline.link', 'string.other.link'],
        settings: { foreground: palette.link }
      }
    ]
  }))
}

register('light', {
  background: '#fcfcfc',
  foreground: '#141414eb',
  comment: '#141414ad',
  keyword: '#b3003f',
  string: '#8f84e0',
  function: '#db704b',
  number: '#b8448b',
  constant: '#206595',
  link: '#3c7cab'
})

register('dark', {
  background: '#141414',
  foreground: '#d6d6dd',
  comment: '#6e7781',
  keyword: '#82d2ce',
  string: '#e394dc',
  function: '#efb080',
  number: '#ebc88d',
  constant: '#f8c762',
  link: '#87c3ff'
})

const highlighter = new WorkerPoolManager(
  { workerFactory: () => new HighlightWorker(), poolSize: 2 },
  { theme: themes }
)

highlighter.initialize()

export function createViewer(
  render: Pick<CodeViewOptions<undefined, undefined>, 'renderCodeViewHeader' | 'renderCustomHeader'>
): CodeView {
  return new CodeView(
    {
      theme: themes,
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
      unsafeCSS: `
      :host {
        --diffs-font-family: var(--font-mono);
        --diffs-header-font-family: var(--font-mono);
        --diffs-font-size: 12px;
        --diffs-line-height: ${LINE_HEIGHT}px;
        --diffs-addition-color-override: var(--added);
        --diffs-deletion-color-override: var(--removed);
        --diffs-bg-addition-override: var(--added-line);
        --diffs-bg-addition-number-override: var(--added-line);
        --diffs-bg-deletion-override: var(--removed-line);
        --diffs-bg-deletion-number-override: var(--removed-line);
        --diffs-fg-number-override: var(--placeholder);
        --diffs-bg-separator-override: var(--muted);
      }
      [data-line-type^='change'] {
        --mix-light: 0%;
        --mix-dark: 0%;
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
      ...render
    },
    highlighter
  )
}

export function changesOf(hunks: Hunk[]): Changes {
  return {
    additions: hunks.reduce((sum, hunk) => sum + hunk.additionLines, 0),
    deletions: hunks.reduce((sum, hunk) => sum + hunk.deletionLines, 0)
  }
}
