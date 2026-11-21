import { homedir } from 'node:os'
import { join } from 'node:path'
import { nativeImage } from 'electron'
import type { App, CheckOutcome, InstallOutcome, Progress, UpgradeOutcome } from '$shared/apps'
import { failure } from '../errors'
import { readBundle } from './bundle'
import { feedOf, fetchUpdates } from './feeds'
import { fs, rmSync } from './fs'
import { discard, install, stage, type Staged } from './install'
import { isRunning } from './processes'

const folders = ['/Applications', join(homedir(), 'Applications')]

const waiting = new Map<string, Staged>()

async function readApp(path: string): Promise<App | undefined> {
  const bundle = await readBundle(path)
  const feed = await feedOf(bundle)

  if (feed === undefined) return undefined

  const { name, version, build } = bundle
  const icon = await nativeImage.createThumbnailFromPath(path, { width: 96, height: 96 })

  return { path, name, version, build, feed: feed.url, icon: icon.toDataURL() }
}

export async function list(): Promise<App[]> {
  const listed = await Promise.all(
    folders.map(async (folder) =>
      (await fs.readdir(folder).catch(() => [])).flatMap((name) =>
        name.endsWith('.app') ? [join(folder, name)] : []
      )
    )
  )

  const apps = await Promise.all(listed.flat().map((path) => readApp(path).catch(() => undefined)))

  return apps.filter((app) => app !== undefined).toSorted((a, b) => a.name.localeCompare(b.name))
}

export async function check(path: string): Promise<CheckOutcome> {
  try {
    const updates = await fetchUpdates(await readBundle(path))

    return { status: 'checked', release: updates.at(0)?.release }
  } catch (cause) {
    return failure(cause)
  }
}

export async function upgrade(
  path: string,
  report: (progress: Progress) => void
): Promise<UpgradeOutcome> {
  try {
    const bundle = await readBundle(path)
    const staged = await stage(bundle, await fetchUpdates(bundle), report)

    if (await isRunning(bundle)) {
      waiting.set(path, staged)

      return { status: 'waiting' }
    }

    return await install(staged)
  } catch (cause) {
    return failure(cause)
  }
}

function takeWaiting(path: string): Staged | undefined {
  const staged = waiting.get(path)

  waiting.delete(path)

  return staged
}

export async function forceUpgrade(path: string): Promise<InstallOutcome> {
  const staged = takeWaiting(path)

  if (staged === undefined) {
    return { status: 'failed', message: 'No upgrade is waiting for this app.' }
  }

  return install(staged)
}

export async function discardUpgrade(path: string): Promise<void> {
  const staged = takeWaiting(path)

  if (staged !== undefined) await discard(staged)
}

export function discardWaiting(): void {
  for (const { work } of waiting.values()) rmSync(work, { recursive: true, force: true })
}
