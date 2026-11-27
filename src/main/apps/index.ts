import { homedir } from 'node:os'
import { join } from 'node:path'
import { nativeImage } from 'electron'
import { failure } from '$platform/errors'
import type { App, CheckOutcome, Progress, UpgradeOutcome } from '$shared/apps'
import { readBundle } from './bundle'
import { feedOf, fetchUpdates } from './feeds'
import { fs, rmSync } from './fs'
import { install, stage, type Staged } from './install'
import { isRunning } from './processes'

const folders = ['/Applications', join(homedir(), 'Applications')]

const waiting = new Map<string, { staged: Staged; answer: (quit: boolean) => void }>()

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
    await using staged = await stage(bundle, await fetchUpdates(bundle), report)

    if (await isRunning(bundle)) {
      const { promise, resolve } = Promise.withResolvers<boolean>()

      waiting.set(path, { staged, answer: resolve })
      report({ stage: 'waiting' })

      if (!(await promise)) return { status: 'discarded' }

      report({ stage: 'install' })
    }

    return await install(staged)
  } catch (cause) {
    return failure(cause)
  }
}

export function answerQuit(path: string, quit: boolean): void {
  waiting.get(path)?.answer(quit)
  waiting.delete(path)
}

export function discardWaiting(): void {
  for (const { staged } of waiting.values()) rmSync(staged.work, { recursive: true, force: true })
}
