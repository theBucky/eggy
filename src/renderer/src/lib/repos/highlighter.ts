import { registerCustomTheme } from '@pierre/diffs'
import { WorkerPoolManager } from '@pierre/diffs/worker'
import HighlightWorker from '@pierre/diffs/worker/worker.js?worker'

export const DIFF_THEME = 'app-light'

// The design system's light editor palette, which no bundled theme matches.
registerCustomTheme(DIFF_THEME, async () => ({
  name: DIFF_THEME,
  type: 'light',
  colors: {
    'editor.background': '#ffffff',
    'editor.foreground': '#141414eb'
  },
  tokenColors: [
    {
      scope: ['comment', 'punctuation.definition.comment', 'string.quoted.docstring'],
      settings: { foreground: '#141414ad' }
    },
    {
      scope: [
        'keyword',
        'storage',
        'keyword.operator.new',
        'keyword.operator.expression',
        'entity.name.tag'
      ],
      settings: { foreground: '#b3003f' }
    },
    { scope: ['keyword.operator', 'punctuation'], settings: { foreground: '#141414eb' } },
    {
      scope: ['string', 'punctuation.definition.string', 'string.regexp'],
      settings: { foreground: '#8f84e0' }
    },
    {
      scope: ['entity.name.function', 'support.function', 'entity.other.attribute-name'],
      settings: { foreground: '#db704b' }
    },
    { scope: ['constant.numeric'], settings: { foreground: '#b8448b' } },
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
      settings: { foreground: '#206595' }
    },
    { scope: ['markup.underline.link', 'string.other.link'], settings: { foreground: '#3c7cab' } }
  ]
}))

// Highlighting runs in workers, which start with the app, so neither a slide nor a first open waits
// on compiling a language's grammar.
export const highlighter = new WorkerPoolManager(
  { workerFactory: () => new HighlightWorker(), poolSize: 2 },
  { theme: DIFF_THEME }
)

highlighter.initialize()
