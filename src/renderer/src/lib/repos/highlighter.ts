import { registerCustomTheme } from '@pierre/diffs'
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

export const DIFF_THEMES = { light: 'app-light', dark: 'app-dark' }

// The design system's editor palettes, which no bundled theme matches.
function register(type: keyof typeof DIFF_THEMES, palette: Palette): void {
  const name = DIFF_THEMES[type]

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
  background: '#ffffff',
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
  background: '#181818',
  foreground: '#d6d6dd',
  comment: '#6e7781',
  keyword: '#82d2ce',
  string: '#e394dc',
  function: '#efb080',
  number: '#ebc88d',
  constant: '#f8c762',
  link: '#87c3ff'
})

// Highlighting runs in workers, which start with the app, so neither a slide nor a first open waits
// on compiling a language's grammar.
export const highlighter = new WorkerPoolManager(
  { workerFactory: () => new HighlightWorker(), poolSize: 2 },
  { theme: DIFF_THEMES }
)

highlighter.initialize()
