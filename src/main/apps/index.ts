import { homedir } from 'node:os'
import { join } from 'node:path'
import { nativeImage } from 'electron'
import { failure } from '$platform/errors'
import type { Handlers, Send } from '$platform/ipc'
import type { App, CheckOutcome, Events, Progress, Requests, UpgradeOutcome } from '$shared/apps'
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

async function list(): Promise<App[]> {
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

async function check(path: string): Promise<CheckOutcome> {
  try {
    const release = (await fetchUpdates(await readBundle(path))).at(0)?.release

    return release === undefined ? { status: 'current' } : { status: 'outdated', release }
  } catch (cause) {
    return failure(cause)
  }
}

async function upgrade(
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

function answerQuit(path: string, quit: boolean): void {
  waiting.get(path)?.answer(quit)
  waiting.delete(path)
}

export function discardWaiting(): void {
  for (const { staged } of waiting.values()) rmSync(staged.work, { recursive: true, force: true })
}

export function handlers(send: Send<Events>): Handlers<Requests> {
  return {
    listApps: () => list(),
    checkApp: (_, path) => check(path),
    upgradeApp: (_, path) => upgrade(path, (progress) => send('appProgress', path, progress)),
    answerAppQuit: (_, path, quit) => answerQuit(path, quit)
  }
}
