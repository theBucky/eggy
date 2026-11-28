import { builtinModules } from 'node:module'
import { posix, relative, resolve } from 'node:path'
import { defineRule, eslintCompatPlugin, type ESTree } from '@oxlint/plugins'

type Layer = {
  root: string
  module: 'files' | 'folder' | 'children'
  aliases: string[]
  packages: 'node' | 'browser' | string[]
}

const LAYERS: Layer[] = [
  { root: 'src/shared', module: 'folder', aliases: [], packages: [] },
  { root: 'src/preload', module: 'folder', aliases: ['$shared'], packages: ['electron'] },
  { root: 'src/main', module: 'files', aliases: ['$platform', '$shared'], packages: 'node' },
  { root: 'src/main', module: 'children', aliases: ['$platform', '$shared'], packages: 'node' },
  { root: 'src/renderer', module: 'files', aliases: ['$shell'], packages: 'browser' },
  {
    root: 'src/renderer/shell',
    module: 'folder',
    aliases: ['$features', '$source', '$client', '$primitives', '$shared'],
    packages: 'browser'
  },
  {
    root: 'src/renderer/features',
    module: 'children',
    aliases: ['$source', '$client', '$primitives', '$shared'],
    packages: 'browser'
  },
  {
    root: 'src/renderer/source',
    module: 'folder',
    aliases: ['$client', '$primitives', '$shared'],
    packages: 'browser'
  },
  { root: 'src/renderer/client', module: 'folder', aliases: ['$shared'], packages: 'browser' },
  {
    root: 'src/renderer/primitives',
    module: 'folder',
    aliases: ['$primitives'],
    packages: 'browser'
  }
]

const NODE_ONLY = new Set([...builtinModules, 'electron', 'original-fs', '@electron-toolkit/utils'])

const REPO = resolve(import.meta.dirname, '../../..')

const list = new Intl.ListFormat('en')

type Module = { layer: Layer; root: string }

function rootOf({ root, module }: Layer, path: string[]): string | undefined {
  const folder = root.split('/')
  const below = path.length - folder.length

  if (!folder.every((segment, index) => segment === path[index])) return undefined

  if (module === 'children') {
    return below > 1 ? path.slice(0, folder.length + 1).join('/') : undefined
  }

  return (module === 'files' ? below === 1 : below > 0) ? root : undefined
}

function moduleOf(file: string): Module | undefined {
  const path = file.split('/')

  for (const layer of LAYERS) {
    const root = rootOf(layer, path)

    if (root !== undefined) return { layer, root }
  }

  return undefined
}

function allows({ layer, root }: Module, file: string, specifier: string): boolean {
  if (specifier.startsWith('/')) return false

  if (specifier.startsWith('.')) {
    const target = posix.join(posix.dirname(file), specifier)

    return layer.module === 'files'
      ? posix.dirname(target) === root
      : target === root || target.startsWith(`${root}/`)
  }

  const segments = specifier.split('/')

  if (specifier.startsWith('$')) {
    return layer.aliases.some((alias) => alias === segments[0]) && !segments.includes('..')
  }

  if (layer.packages === 'node') return true

  const name = segments.slice(0, specifier.startsWith('@') ? 2 : 1).join('/')

  return layer.packages === 'browser'
    ? !name.startsWith('node:') && !NODE_ONLY.has(name)
    : layer.packages.includes(name)
}

function sourcesOf({ module, aliases, packages }: Layer): string {
  const sources = Array.isArray(packages) ? packages : [`${packages} packages`]

  return list.format([
    module === 'files' ? 'its direct children' : 'its own folder',
    ...aliases,
    ...sources
  ])
}

function textOf(node: ESTree.Node): string | undefined {
  if (node.type === 'Literal') return String(node.value)

  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis[0]?.value.cooked ?? undefined
  }

  return undefined
}

function loads(callee: ESTree.Node): boolean {
  if (callee.type === 'Identifier') return callee.name === 'require'

  return (
    callee.type === 'MemberExpression' &&
    callee.object.type === 'MetaProperty' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === 'glob'
  )
}

export const imports = defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'Keep every import inside what the layer of the importing file allows.' },
    messages: {
      crossing: '`{{specifier}}` crosses a boundary. `{{module}}` imports {{sources}}.',
      unlayered: '`{{file}}` belongs to no layer, so nothing says what it may import.'
    }
  },
  createOnce(context) {
    function check(node: ESTree.Node): void {
      const specifier = textOf(node)
      const file = relative(REPO, context.filename)

      if (specifier === undefined || !file.startsWith('src/')) return

      const owner = moduleOf(file)

      if (owner === undefined) {
        context.report({ node, messageId: 'unlayered', data: { file } })
      } else if (!allows(owner, file, specifier)) {
        context.report({
          node,
          messageId: 'crossing',
          data: { specifier, module: owner.root, sources: sourcesOf(owner.layer) }
        })
      }
    }

    return {
      ImportDeclaration: ({ source }) => check(source),
      ImportExpression: ({ source }) => check(source),
      ExportNamedDeclaration: ({ source }) => {
        if (source !== null) check(source)
      },
      ExportAllDeclaration: ({ source }) => check(source),
      TSImportType: ({ source }) => check(source),
      CallExpression: ({ callee, arguments: [first] }) => {
        if (first === undefined || !loads(callee)) return

        for (const pattern of first.type === 'ArrayExpression' ? first.elements : [first]) {
          if (pattern !== null) check(pattern)
        }
      }
    }
  }
})

export default eslintCompatPlugin({ meta: { name: 'boundaries' }, rules: { imports } })
