import * as z from 'zod'
import type { Bundle } from '../bundle'
import { electronUpdater } from './electron-updater'
import type { Feed, Framework, Update } from './feed'
import { knownApps } from './known-apps'
import { sparkle } from './sparkle'

const frameworks: Framework[] = [knownApps, sparkle, electronUpdater]

export async function feedOf(bundle: Bundle): Promise<Feed | undefined> {
  for (const framework of frameworks) {
    const feed = await framework(bundle)

    if (feed !== undefined) return feed
  }

  return undefined
}

export async function fetchUpdates(bundle: Bundle): Promise<Update[]> {
  const feed = await feedOf(bundle)

  if (feed === undefined) throw new Error(`${bundle.name} no longer names its update feed.`)

  try {
    return await feed.check()
  } catch (cause) {
    throw cause instanceof z.ZodError ? new Error('The update feed is malformed.') : cause
  }
}
