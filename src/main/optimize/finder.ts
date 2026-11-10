import { readdir } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { shell } from 'electron'
import type { OptimizeOutcome } from '$shared/api'
import { plural } from '$shared/plural'
import { FULL_DISK_ACCESS, broken, errorCode, exec, output } from './support'

export async function quickLook(): Promise<OptimizeOutcome> {
  await output('/usr/bin/qlmanage', ['-r', 'cache'], 15_000)
  await output('/usr/bin/qlmanage', ['-r'], 15_000)

  return { status: 'applied', message: 'Reset QuickLook thumbnails and previews.' }
}

const LISTS = /\.sfl[234]$/

export async function sharedFileLists(): Promise<OptimizeOutcome> {
  const folder = join(homedir(), 'Library/Application Support/com.apple.sharedfilelist')
  let names: string[]

  try {
    names = await readdir(folder, { recursive: true })
  } catch (cause) {
    const code = errorCode(cause)

    if (code === 'ENOENT') return { status: 'unchanged', message: 'No favorites or recents.' }

    if (code === 'EPERM') return { status: 'skipped', message: FULL_DISK_ACCESS }

    throw cause
  }

  // Each app keeps its own recent documents, which it rewrites whenever it opens a file.
  const paths = names
    .filter((name) => LISTS.test(name) && !name.includes('ApplicationRecentDocuments'))
    .map((name) => join(folder, name))

  const found = await broken(paths)

  if (found.length === 0) return { status: 'unchanged', message: 'No broken favorites or recents.' }

  for (const path of found) await shell.trashItem(path)

  return {
    status: 'applied',
    message: `Moved ${plural(found.length, 'broken list', 'broken lists')} to the Trash. macOS rebuilds them.`
  }
}

const VOLUMES = ['DSDontWriteNetworkStores', 'DSDontWriteUSBStores']

export async function networkVolumes(): Promise<OptimizeOutcome> {
  let changed = 0

  for (const key of VOLUMES) {
    const read = await exec('/usr/bin/defaults', ['read', 'com.apple.desktopservices', key], 5000)

    if (read.code === 0 && read.stdout.trim() === '1') continue

    await output(
      '/usr/bin/defaults',
      ['write', 'com.apple.desktopservices', key, '-bool', 'true'],
      5000
    )
    changed++
  }

  return changed === 0
    ? { status: 'unchanged', message: 'Finder already skips network and USB volumes.' }
    : {
        status: 'applied',
        message: 'Finder stops writing .DS_Store files to network and USB volumes once it restarts.'
      }
}
