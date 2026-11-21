import { tmpdir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { net, shell } from 'electron'
import type { InstallOutcome, Progress, Release } from '$shared/apps'
import { failure } from '../errors'
import { output } from '../exec'
import { unpack } from './archive'
import { readBundle, type Bundle } from './bundle'
import type { Update } from './feeds/feed'
import { fs } from './fs'
import { forceQuit } from './processes'

export type Staged = {
  bundle: Bundle
  work: string
  replacement: string
}

// Renaming the replacement into place only works within a volume, so it stages on the app's.
async function makeWork(path: string): Promise<string> {
  const folder = dirname(path)
  const [app, temporary] = await Promise.all([fs.stat(folder), fs.stat(tmpdir())])

  return fs.mkdtemp(join(app.dev === temporary.dev ? tmpdir() : folder, '.eggy-'))
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
  await using handle = await fs.open(file, 'w')
  let received = 0
  let reported = 0

  report({ stage: 'download', percent: total === undefined ? undefined : 0 })

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
}

async function prepare(
  bundle: Bundle,
  update: Update,
  report: (progress: Progress) => void
): Promise<Staged> {
  const work = await makeWork(bundle.path)

  try {
    const archive = join(work, basename(new URL(update.release.url).pathname))

    await download(update.release, archive, report)
    report({ stage: 'install' })

    const replacement = await unpack(archive, work, bundle)

    await update.verify(archive, replacement)

    return { bundle, work, replacement }
  } catch (cause) {
    await fs.rm(work, { recursive: true, force: true })
    throw cause
  }
}

export async function stage(
  bundle: Bundle,
  updates: Update[],
  report: (progress: Progress) => void
): Promise<Staged> {
  for (const [index, update] of updates.entries()) {
    try {
      return await prepare(bundle, update, report)
    } catch (cause) {
      if (index === updates.length - 1) throw cause
    }
  }

  throw new Error(`${bundle.name} is already up to date.`)
}

export async function discard({ work }: Staged): Promise<void> {
  await fs.rm(work, { recursive: true, force: true })
}

export async function install(staged: Staged): Promise<InstallOutcome> {
  const { bundle, replacement } = staged
  const { path } = bundle

  try {
    const wasRunning = await forceQuit(bundle)

    // Moving a whole bundle avoids the app management access needed to delete files inside.
    await shell.trashItem(path)
    await fs.rename(replacement, path)

    const { version, build } = await readBundle(path)

    // The upgrade has landed, so an app that fails to reopen stays closed instead of failing it.
    if (wasRunning) await output('/usr/bin/open', ['-g', path]).catch(() => undefined)

    return { status: 'upgraded', version, build }
  } catch (cause) {
    return failure(cause)
  } finally {
    await discard(staged)
  }
}
