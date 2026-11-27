import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

const shared = { $shared: resolve(import.meta.dirname, 'src/shared') }
const platform = { $platform: resolve(import.meta.dirname, 'src/main/platform') }

const layers = Object.fromEntries(
  ['shell', 'features', 'source', 'client', 'primitives'].map((layer) => [
    `$${layer}`,
    resolve(import.meta.dirname, 'src/renderer', layer)
  ])
)

export default defineConfig({
  main: {
    resolve: { alias: { ...platform, ...shared } },
    // Electron's own module, which Node's built-in list leaves out.
    build: { rolldownOptions: { external: ['original-fs'] } }
  },
  preload: {
    resolve: { alias: shared },
    // A sandboxed renderer loads its preload as CommonJS only.
    build: { rolldownOptions: { output: { format: 'cjs' } } }
  },
  renderer: {
    resolve: { alias: { ...layers, ...shared } },
    plugins: [svelte(), tailwindcss()],
    build: {
      minify: true,
      // Lightning CSS folds `animation-timeline` into the `animation` shorthand, which Chromium
      // rejects, silently dropping every scroll-driven fade.
      cssMinify: false
    }
  }
})
