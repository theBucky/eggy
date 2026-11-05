import { execFile } from 'node:child_process'
import { createPublicKey, verify } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdtemp, open, readdir, readFile, rename, rm, stat } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { basename, dirname, extname, join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { DOMParser, onErrorStopParsing } from '@xmldom/xmldom'
import { nativeImage, net, shell } from 'electron'
import type {
  App,
  CheckOutcome,
  Failure,
  InstallOutcome,
  Progress,
  Release,
  UpdateOutcome
} from '../shared/api'
import { findUpdate, type Feed, type Update } from './appcast'

type Source = Feed & {
  preferences?: Record<string, string>
}

type Bundle = {
  path: string
  id: string
  name: string
  version: string
  build: string
  executable: string
  feed: string | undefined
  key: string | undefined
}

type Staged = {
  work: string
  replacement: string
  bundle: Bundle
}

const folders = ['/Applications', join(homedir(), 'Applications')]

const waiting = new Map<string, Staged>()

// Apps that set their feed in code at launch leave it out of Info.plist or name an outdated one there,
// so these pick it the way the app does.
const knownFeeds = new Map<string, (bundle: Bundle) => Promise<Source>>([
  [
    'com.openai.codex',
    async () => ({
      url: 'https://persistent.oaistatic.com/codex-app-prod/appcast.xml',
      channels: []
    })
  ],
  // OrbStack, whose feed lags a release behind without a rollout bucket.
  [
    'dev.kdrag0n.MacVirt',
    async () => ({
      url: `https://api-updates.orbstack.dev/${process.arch === 'arm64' ? 'arm64' : 'amd64'}/appcast.xml?bucket=0`,
      channels: ['stable']
    })
  ],
  // CleanShot X, whose Info.plist feed ends at version 3 since later releases go to licensed copies.
  [
    'pl.maketheweb.cleanshotx',
    async () => ({
      url: 'https://legit.maketheweb.io/api/v1/appcast',
      channels: [],
      preferences: { key: 'activationKey' }
    })
  ],
  // Ghostty, which picks a feed by the update channel its config resolves to. Ghostty's own loader
  // finds the config files and falls back to the channel of the installed build.
  [
    'com.mitchellh.ghostty',
    async ({ executable }) => {
      const config = await run(executable, ['+show-config'])
      const channel = /^auto-update-channel = tip$/m.test(config) ? 'tip' : 'release'

      return { url: `https://${channel}.files.ghostty.org/appcast.xml`, channels: [] }
    }
  ]
])

const iconSize = { width: 96, height: 96 }

function run(file: string, args: string[], input = ''): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(file, args, { maxBuffer: Infinity }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr.trim() || error.message))
      else resolve(stdout)
    })

    child.stdin?.end(input)
  })
}

function failure(cause: unknown): Failure {
  return { status: 'failed', message: cause instanceof Error ? cause.message : String(cause) }
}

// xml preserves property list dates and data that json cannot represent.
async function readInfo(path: string): Promise<Map<string, string>> {
  const xml = await run('plutil', [
    '-convert',
    'xml1',
    '-o',
    '-',
    '--',
    join(path, 'Contents/Info.plist')
  ])

  const dict = new DOMParser({ onError: onErrorStopParsing })
    .parseFromString(xml, 'text/xml')
    .getElementsByTagName('dict')
    .item(0)

  // Each key element comes right before the element that holds its value.
  const fields = [...(dict?.children ?? [])]
  const strings = new Map<string, string>()

  for (let index = 0; index + 1 < fields.length; index += 2) {
    const value = fields[index + 1]

    if (value.tagName === 'string') {
      strings.set(fields[index].textContent ?? '', value.textContent ?? '')
    }
  }

  return strings
}

async function readBundle(path: string): Promise<Bundle> {
  const info = await readInfo(path)
  const id = info.get('CFBundleIdentifier')
  const build = info.get('CFBundleVersion')
  const executable = info.get('CFBundleExecutable')

  if (id === undefined || build === undefined || executable === undefined) {
    throw new Error(`${basename(path)} names no identifier, version, or executable.`)
  }

  return {
    path,
    id,
    name: info.get('CFBundleDisplayName') ?? info.get('CFBundleName') ?? basename(path, '.app'),
    version: info.get('CFBundleShortVersionString') ?? build,
    build,
    executable: join(path, 'Contents/MacOS', executable),
    feed: info.get('SUFeedURL'),
    key: info.get('SUPublicEDKey')
  }
}

async function locateFeed(bundle: Bundle): Promise<Source | undefined> {
  const locate = knownFeeds.get(bundle.id)

  if (locate !== undefined) return locate(bundle)

  return bundle.feed === undefined ? undefined : { url: bundle.feed, channels: [] }
}

async function readApp(path: string): Promise<App | undefined> {
  const bundle = await readBundle(path)
  const feed = await locateFeed(bundle)

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
    .filter(
      (path) =>
        path.endsWith('.app') && existsSync(join(path, 'Contents/Frameworks/Sparkle.framework'))
    )

  const apps = await Promise.all(paths.map((path) => readApp(path).catch(() => undefined)))

  return apps.filter((app) => app !== undefined).toSorted((a, b) => a.name.localeCompare(b.name))
}

async function fetchUpdate(bundle: Bundle): Promise<Update | undefined> {
  const feed = await locateFeed(bundle)

  if (feed === undefined) throw new Error(`${bundle.name} no longer names its update feed.`)

  const url = new URL(feed.url)

  for (const [parameter, key] of Object.entries(feed.preferences ?? {})) {
    url.searchParams.set(parameter, (await run('defaults', ['read', bundle.id, key])).trim())
  }

  const response = await net.fetch(url.href)

  if (!response.ok) throw new Error(`The update feed answered with HTTP ${response.status}.`)

  return findUpdate(await response.text(), feed, bundle.build)
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

function verifySignature(archive: Buffer, signature: string | undefined, key: string): void {
  if (signature === undefined) {
    throw new Error('The update is unsigned, but the app expects a signature.')
  }

  const publicKey = createPublicKey({
    key: { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(key, 'base64').toString('base64url') },
    format: 'jwk'
  })

  if (!verify(null, archive, publicKey, Buffer.from(signature, 'base64'))) {
    throw new Error("The update's signature doesn't match the app's key.")
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
async function forceQuit(bundle: Bundle): Promise<void> {
  for (let pass = 0; pass < 20; pass++) {
    const pids = await pidsOf(bundle)

    if (pids.length === 0) return

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

    if (bundle.key !== undefined) {
      verifySignature(await readFile(archive), update.signature, bundle.key)
    }

    return { work, replacement: await unpack(archive, work, bundle.id), bundle }
  } catch (cause) {
    await rm(work, { recursive: true, force: true })
    throw cause
  }
}

async function install({ work, replacement, bundle }: Staged): Promise<InstallOutcome> {
  const { path } = bundle

  try {
    await forceQuit(bundle)

    // moving a whole bundle avoids the app management access needed to delete files inside.
    await shell.trashItem(path)
    await rename(replacement, path)

    const { version, build } = await readBundle(path)

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
