import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        $lib: resolve(import.meta.dirname, 'src/renderer/src/lib'),
        $shared: resolve(import.meta.dirname, 'src/shared')
      }
    },
    plugins: [svelte(), tailwindcss()],
    // The diff highlighter's worker loads languages on demand, which only module workers can split.
    worker: { format: 'es' },
    build: {
      minify: true,
      // Lightning CSS folds `animation-timeline` into the `animation` shorthand, which Chromium
      // rejects, silently dropping every scroll-driven fade.
      cssMinify: false
    }
  }
})
