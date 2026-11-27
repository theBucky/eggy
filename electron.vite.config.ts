import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'
import { parse } from 'jsonc-parser'
import * as z from 'zod'

const Glob = z.string().endsWith('/*')

const Project = z.object({
  compilerOptions: z.object({ paths: z.record(Glob, z.tuple([Glob])) })
})

function aliasesOf(project: string): Record<string, string> {
  const file = resolve(import.meta.dirname, project)
  const { paths } = Project.parse(parse(readFileSync(file, 'utf8'))).compilerOptions

  return Object.fromEntries(
    Object.entries(paths).map(([alias, [target]]) => [
      alias.slice(0, -2),
      resolve(dirname(file), target.slice(0, -2))
    ])
  )
}

const node = { alias: aliasesOf('tsconfig.node.json') }

export default defineConfig({
  main: {
    resolve: node,
    // Electron's own module, which Node's built-in list leaves out.
    build: { rolldownOptions: { external: ['original-fs'] } }
  },
  preload: {
    resolve: node,
    // A sandboxed renderer loads its preload as CommonJS only.
    build: { rolldownOptions: { output: { format: 'cjs' } } }
  },
  renderer: {
    resolve: { alias: aliasesOf('tsconfig.web.json') },
    plugins: [svelte(), tailwindcss()],
    build: {
      minify: true,
      // Lightning CSS folds `animation-timeline` into the `animation` shorthand, which Chromium
      // rejects, silently dropping every scroll-driven fade.
      cssMinify: false
    }
  }
})
