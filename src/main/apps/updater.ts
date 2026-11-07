import { existsSync, rmSync } from 'node:fs'
import { mkdtemp, open, readdir, rename, rm, stat } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, extname, join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { nativeImage, net, shell } from 'electron'
import type {
  App,
  CheckOutcome,
  Failure,
  InstallOutcome,
  Progress,
  Release,
  UpdateOutcome
} from '../../shared/api'
import { readBundle, type Bundle } from './bundle'
import { electronUpdater } from './electron-updater'
import type { Framework, Update } from './framework'
import { run } from './run'
import { sparkle } from './sparkle'
import { squirrel } from './squirrel'

type Staged = {
  work: string
  replacement: string
  bundle: Bundle
}

// electron-updater installs through Squirrel, so its marker is the more specific one.
const frameworks: Framework[] = [sparkle, electronUpdater, squirrel]

const folders = ['/Applications', join(homedir(), 'Applications')]

const waiting = new Map<string, Staged>()

const iconSize = { width: 96, height: 96 }

function failure(cause: unknown): Failure {
  return { status: 'failed', message: cause instanceof Error ? cause.message : String(cause) }
}

function frameworkOf(path: string): Framework | undefined {
  return frameworks.find(({ marker }) => existsSync(join(path, 'Contents', marker)))
}

async function fetchUpdate(bundle: Bundle): Promise<Update | undefined> {
  const feed = await frameworkOf(bundle.path)?.locate(bundle)

  if (feed === undefined) throw new Error(`${bundle.name} no longer names its update feed.`)

  return feed.check()
}

async function readApp(path: string): Promise<App | undefined> {
  const bundle = await readBundle(path)
  const feed = await frameworkOf(bundle.path)?.locate(bundle)

  if (feed === undefined) return undefined

  const { name, version, build } = bundle
  const icon = await nativeImage.createThumbnailFromPath(path, iconSize)

  return { path, name, version, build, feed: feed.url, icon: icon.toDataURL() }
}

export async function listApps(): Promise<App[]> {
  const listed = await Promise.all(
    folders.map(async (folder) =>
      (await readdir(folder).catch(() => [])).map((name) => join(folder, name))
    )
  )

  const paths = listed
    .flat()
    .filter((path) => path.endsWith('.app') && frameworkOf(path) !== undefined)

  const apps = await Promise.all(paths.map((path) => readApp(path).catch(() => undefined)))

  return apps.filter((app) => app !== undefined).toSorted((a, b) => a.name.localeCompare(b.name))
}

export async function check(path: string): Promise<CheckOutcome> {
  try {
    const update = await fetchUpdate(await readBundle(path))

    return { status: 'checked', update: update?.release }
  } catch (cause) {
    return failure(cause)
  }
}

async function download(
  release: Release,
  file: string,
  report: (progress: Progress) => void
): Promise<void> {
  const response = await net.fetch(release.url)

  if (!response.ok || response.body === null) {
    throw new Error(`The download answered with HTTP ${response.status}.`)
  }

  const total = Number(response.headers.get('content-length')) || release.size
  const handle = await open(file, 'w')
  let received = 0
  let reported = 0

  report({ stage: 'download', percent: total === undefined ? undefined : 0 })

  try {
    for await (const chunk of response.body) {
      await handle.write(chunk)
      received += chunk.length

      if (total === undefined) continue

      const percent = Math.min(Math.floor((received / total) * 100), 100)

      if (percent > reported) {
        reported = percent
        report({ stage: 'download', percent })
      }
    }
  } finally {
    await handle.close()
  }
}

async function findBundle(dir: string, id: string): Promise<string> {
  for (const name of await readdir(dir)) {
    const path = join(dir, name)

    if (name.endsWith('.app') && (await readBundle(path)).id === id) return path
  }

  throw new Error(`The download holds no app with the identifier ${id}.`)
}

// ditto keeps the symlinks, extended attributes, and code signatures that an app bundle relies on.
async function unpack(archive: string, work: string, id: string): Promise<string> {
  const contents = join(work, 'contents')
  const type = extname(archive).toLowerCase()

  if (type === '.zip') {
    await run('ditto', ['-x', '-k', archive, contents])

    return findBundle(contents, id)
  }

  if (type === '.dmg') {
    const mount = join(work, 'mount')

    // Like Sparkle, this accepts any license agreement the disk image asks about on stdin.
    await run(
      'hdiutil',
      [
        'attach',
        archive,
        '-mountpoint',
        mount,
        '-readonly',
        '-noverify',
        '-nobrowse',
        '-noautoopen'
      ],
      'yes\n'
    )

    try {
      const source = await findBundle(mount, id)
      const copy = join(contents, basename(source))

      await run('ditto', [source, copy])

      return copy
    } finally {
      await run('hdiutil', ['detach', mount, '-force'])
    }
  }

  throw new Error(`Updates packaged as ${type || 'files without an extension'} aren't supported.`)
}

// bundles can also ship cli tools whose processes must stay running.
async function pidsOf({ executable }: Bundle): Promise<number[]> {
  const lines = (await run('ps', ['-axo', 'pid=,comm='])).split('\n')

  return lines.flatMap((line) => {
    const [, pid, command] = /^\s*(\d+) (.+)$/.exec(line) ?? []

    return command === executable ? [Number(pid)] : []
  })
}

// The app can exit on its own between listing and killing.
function kill(pid: number): void {
  try {
    process.kill(pid, 'SIGKILL')
  } catch (cause) {
    if (!(cause instanceof Error && 'code' in cause && cause.code === 'ESRCH')) throw cause
  }
}

// Each pass also catches an instance that launchd restarts.
async function forceQuit(bundle: Bundle): Promise<boolean> {
  for (let pass = 0; pass < 20; pass++) {
    const pids = await pidsOf(bundle)

    if (pids.length === 0) return pass > 0

    for (const pid of pids) kill(pid)

    await sleep(100)
  }

  throw new Error(`${bundle.name} keeps relaunching, so it can't be replaced.`)
}

// Renaming the replacement into place only works within a volume, so it stages on the app's.
async function makeWork(path: string): Promise<string> {
  const folder = dirname(path)
  const [app, temporary] = await Promise.all([stat(folder), stat(tmpdir())])

  return mkdtemp(join(app.dev === temporary.dev ? tmpdir() : folder, '.app-to-date-'))
}

async function stage(path: string, report: (progress: Progress) => void): Promise<Staged> {
  const work = await makeWork(path)

  try {
    const bundle = await readBundle(path)
    const update = await fetchUpdate(bundle)

    if (update === undefined) throw new Error(`${bundle.name} is already up to date.`)

    const archive = join(work, basename(new URL(update.release.url).pathname))

    await download(update.release, archive, report)
    report({ stage: 'install' })

    const replacement = await unpack(archive, work, bundle.id)

    await update.verify(archive, replacement)

    return { work, replacement, bundle }
  } catch (cause) {
    await rm(work, { recursive: true, force: true })
    throw cause
  }
}

async function install({ work, replacement, bundle }: Staged): Promise<InstallOutcome> {
  const { path } = bundle

  try {
    const running = await forceQuit(bundle)

    // moving a whole bundle avoids the app management access needed to delete files inside.
    await shell.trashItem(path)
    await rename(replacement, path)

    const { version, build } = await readBundle(path)

    // The update has landed, so an app that fails to reopen stays closed instead of failing it.
    if (running) await run('open', ['-g', path]).catch(() => undefined)

    return { status: 'updated', version, build }
  } catch (cause) {
    return failure(cause)
  } finally {
    await rm(work, { recursive: true, force: true })
  }
}

export async function update(
  path: string,
  report: (progress: Progress) => void
): Promise<UpdateOutcome> {
  try {
    const staged = await stage(path, report)

    if ((await pidsOf(staged.bundle)).length === 0) return await install(staged)

    waiting.set(path, staged)

    return { status: 'waiting' }
  } catch (cause) {
    return failure(cause)
  }
}

function takeWaiting(path: string): Staged {
  const staged = waiting.get(path)

  if (staged === undefined) throw new Error('No update is waiting for this app.')

  waiting.delete(path)

  return staged
}

export function forceUpdate(path: string): Promise<InstallOutcome> {
  return install(takeWaiting(path))
}

export async function discardUpdate(path: string): Promise<void> {
  await rm(takeWaiting(path).work, { recursive: true, force: true })
}

export function discardWaiting(): void {
  for (const { work } of waiting.values()) rmSync(work, { recursive: true, force: true })
}
