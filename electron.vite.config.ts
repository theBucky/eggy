import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

const shared = { $shared: resolve(import.meta.dirname, 'src/shared') }

export default defineConfig({
  main: {
    resolve: { alias: shared },
    // Electron's own module, which Node's built-in list leaves out.
    build: { rolldownOptions: { external: ['original-fs'] } }
  },
  preload: { resolve: { alias: shared } },
  renderer: {
    resolve: {
      alias: { $lib: resolve(import.meta.dirname, 'src/renderer/src/lib'), ...shared }
    },
    plugins: [svelte(), tailwindcss()],
    build: {
      minify: true,
      // Lightning CSS folds `animation-timeline` into the `animation` shorthand, which Chromium
      // rejects, silently dropping every scroll-driven fade.
      cssMinify: false
    }
  }
})
