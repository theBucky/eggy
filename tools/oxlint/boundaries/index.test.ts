import { resolve } from 'node:path'
import { describe, it } from 'node:test'
import { RuleTester } from 'oxlint/plugins-dev'
import { imports } from './index.ts'

RuleTester.describe = describe

RuleTester.it = it

const tester = new RuleTester({ cwd: resolve(import.meta.dirname, '../../..') })

function importing(filename: string, code: string): RuleTester.ValidTestCase {
  return { name: `${filename}: ${code}`, filename, code }
}

const feature = 'src/renderer/features/apps/apps.svelte.ts'

const allowed = [
  importing('electron.vite.config.ts', "import 'node:fs'"),
  importing('src/shared/ipc.ts', "import './apps'"),
  importing('src/preload/index.ts', "import 'electron'"),
  importing('src/preload/index.ts', "import '$shared/ipc'"),
  importing('src/main/index.ts', "import './apps'"),
  importing('src/main/apps/feeds/sparkle.ts', "import '../bundle'"),
  importing('src/main/apps/index.ts', "import '$platform/exec'"),
  importing('src/main/apps/index.ts', "import 'electron'"),
  importing('src/renderer/main.ts', "import '$shell/shell.svelte'"),
  importing('src/renderer/shell/sources.svelte.ts', "import '$features/apps/apps.svelte'"),
  importing(feature, "import './quit-prompt.svelte'"),
  importing(feature, "import '$source/source.svelte'"),
  importing(feature, "import 'svelte/reactivity'"),
  importing('src/renderer/source/status.ts', "import '$primitives/ui/badge'"),
  importing('src/renderer/client/paths.ts', "import '$shared/english'"),
  importing('src/renderer/primitives/ui/button/index.ts', "import '$primitives/utils'")
]

const crossing = [
  importing('src/shared/apps.ts', "import 'node:os'"),
  importing('src/shared/apps.ts', "import 'zod'"),
  importing('src/shared/apps.ts', "import '../main/apps'"),
  importing('src/preload/index.ts', "import 'node:fs'"),
  importing('src/preload/index.ts', "import '../main/shell'"),
  importing('src/main/index.ts', "import './apps/install'"),
  importing('src/main/packages/index.ts', "import '../repos'"),
  importing('src/main/packages/index.ts', "import '$platform/../repos'"),
  importing('src/main/packages/index.ts', "import '/usr/lib/node_modules/zod'"),
  importing('src/renderer/main.ts', "import '$features/apps/apps.svelte'"),
  importing(feature, "import '../repos/pool'"),
  importing(feature, "import '$features/repos/pool'"),
  importing(feature, "import '$shell/view'"),
  importing(feature, "import 'node:fs'"),
  importing(feature, "import 'fs/promises'"),
  importing(feature, "import type { App } from 'electron'"),
  importing(feature, "export * from '$shell/view'"),
  importing(feature, "export { Pool } from '../repos/pool'"),
  importing(feature, "export type Shell = import('$shell/view').View"),
  importing(feature, "await import('../repos/pool')"),
  importing(feature, "import.meta.glob('../repos/*.ts')"),
  importing(feature, "require('node:fs')"),
  importing('src/renderer/source/status.ts', "import '$features/apps/apps.svelte'"),
  importing('src/renderer/client/api.ts', "import '$primitives/format'"),
  importing('src/renderer/primitives/format.ts', "import '$client/api'"),
  importing('src/renderer/primitives/format.ts', "import '$shared/english'")
]

const unlayered = [
  importing('src/extra/thing.ts', "import './other'"),
  importing('src/renderer/extra/thing.ts', "import '$shared/english'"),
  importing('src/renderer/features/thing.ts', "import '$shared/english'")
]

tester.run('imports', imports, {
  valid: allowed,
  invalid: [
    ...crossing.map((test) => ({ ...test, errors: [{ messageId: 'crossing' }] })),
    ...unlayered.map((test) => ({ ...test, errors: [{ messageId: 'unlayered' }] }))
  ]
})
