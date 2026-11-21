import { lstat, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { shell } from 'electron'
import { list, plural } from '$shared/english'
import type { OptimizeOutcome } from '$shared/optimize'
import { exec } from '../exec'
import { NEEDS_FULL_DISK_ACCESS, access, broken, entries, sqlite } from './support'

const home = homedir()

export async function savedStates(): Promise<OptimizeOutcome> {
  const folder = join(home, 'Library/Saved Application State')
  const cutoff = Date.now() - 30 * 86_400_000
  const old: string[] = []

  for (const name of await entries(folder)) {
    if (!name.endsWith('.savedState')) continue

    const path = join(folder, name)
    const info = await lstat(path)

    if (info.isDirectory() && info.mtimeMs < cutoff) old.push(path)
  }

  if (old.length === 0) {
    return { status: 'unchanged', message: 'No saved states older than 30 days.' }
  }

  for (const path of old) await shell.trashItem(path)

  return {
    status: 'applied',
    message: `Moved ${plural(old.length, 'saved state', 'saved states')} to the Trash.`
  }
}

// Apple's own preferences belong to the system, which repairs or rewrites them itself.
function owned(name: string): boolean {
  return (
    name.endsWith('.plist') &&
    !name.startsWith('com.apple.') &&
    !name.startsWith('.GlobalPreferences') &&
    name !== 'loginwindow.plist'
  )
}

export async function preferences(): Promise<OptimizeOutcome> {
  const folders = [join(home, 'Library/Preferences'), join(home, 'Library/Preferences/ByHost')]
  const paths: string[] = []

  for (const folder of folders) {
    for (const name of await entries(folder)) {
      const path = join(folder, name)

      if (owned(name) && (await lstat(path)).isFile()) paths.push(path)
    }
  }

  const found = await broken(paths)

  if (found.length === 0) return { status: 'unchanged', message: 'Every preference file parses.' }

  for (const path of found) await shell.trashItem(path)

  return {
    status: 'applied',
    message: `Moved ${plural(found.length, 'broken preference file', 'broken preference files')} to the Trash.`
  }
}

const DATABASES = {
  Safari: [join(home, 'Library/Safari/History.db'), join(home, 'Library/Safari/TopSites.db')],
  Messages: [join(home, 'Library/Messages/chat.db')]
}

async function running(app: string): Promise<boolean> {
  const ran = await exec('/usr/bin/pgrep', ['-x', app], { timeout: 5000 })

  // pgrep exits with 1 when no process matches.
  if (ran.exit === 1) return false

  if (ran.exit !== 0) throw new Error(ran.stderr.trim() || "Couldn't list running apps.")

  return true
}

type Compaction = 'compacted' | 'compact' | 'large' | 'busy' | 'denied' | 'missing'

async function compact(path: string): Promise<Compaction> {
  const readable = await access(path)

  // sqlite reports why it can't open a file the user can't read.
  if (readable === 'missing' || readable === 'denied') return readable

  // A large database takes long enough to compact that a stalled run would look like a hang.
  if ((await stat(path)).size > 100 * 2 ** 20) return 'large'

  const counts = await sqlite(path, ['PRAGMA page_count;', 'PRAGMA freelist_count;'], 10_000)

  if (counts === undefined) return 'busy'

  const [pages, free] = counts.split('\n').map(Number)

  if (free * 20 < pages) return 'compact'

  const integrity = await sqlite(path, ['PRAGMA integrity_check;'], 20_000)

  if (integrity === undefined) return 'busy'

  if (integrity !== 'ok') {
    throw new Error(`${basename(path)} failed its integrity check, so it was left as is.`)
  }

  return (await sqlite(path, ['VACUUM;'], 60_000)) === undefined ? 'busy' : 'compacted'
}

export async function appDatabases(): Promise<OptimizeOutcome> {
  const open: string[] = []

  for (const app of Object.keys(DATABASES)) if (await running(app)) open.push(app)

  if (open.length > 0) {
    return {
      status: 'skipped',
      message: `Skipped while ${list.format(open)} ${open.length === 1 ? 'is' : 'are'} open.`
    }
  }

  const results: Compaction[] = []

  for (const path of Object.values(DATABASES).flat()) results.push(await compact(path))

  const tally = (result: Compaction): number => results.filter((each) => each === result).length

  if (tally('compacted') > 0) {
    return {
      status: 'applied',
      message: `Compacted ${plural(tally('compacted'), 'database', 'databases')}.`
    }
  }

  if (tally('denied') > 0) return NEEDS_FULL_DISK_ACCESS

  if (tally('busy') > 0) {
    return {
      status: 'skipped',
      message: `${plural(tally('busy'), 'database is', 'databases are')} in use by a background process.`
    }
  }

  if (tally('large') > 0) {
    return {
      status: 'skipped',
      message: `${plural(tally('large'), 'database is', 'databases are')} over 100 MB, too large to compact safely.`
    }
  }

  return tally('compact') > 0
    ? { status: 'unchanged', message: 'Every database is already compact.' }
    : { status: 'unchanged', message: 'No databases to compact.' }
}
