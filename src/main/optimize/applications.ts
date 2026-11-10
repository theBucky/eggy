import { lstat, stat } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { shell } from 'electron'
import type { OptimizeOutcome } from '$shared/api'
import { plural } from '$shared/plural'
import { FULL_DISK_ACCESS, access, broken, entries, exec, exists, output, sqlite } from './support'

const home = homedir()
const list = new Intl.ListFormat('en')

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

const DATABASES = [
  { app: 'Safari', path: join(home, 'Library/Safari/History.db') },
  { app: 'Safari', path: join(home, 'Library/Safari/TopSites.db') },
  { app: 'Messages', path: join(home, 'Library/Messages/chat.db') }
]

async function running(app: string): Promise<boolean> {
  const ran = await exec('/usr/bin/pgrep', ['-x', app], 5000)

  // pgrep exits with 1 when no process matches.
  if (ran.code === 1) return false

  if (ran.code !== 0) throw new Error(ran.stderr.trim() || "Couldn't list running apps.")

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
  const apps = [...new Set(DATABASES.map(({ app }) => app))]
  const open: string[] = []

  for (const app of apps) if (await running(app)) open.push(app)

  if (open.length > 0) {
    return {
      status: 'skipped',
      message: `Skipped while ${list.format(open)} ${open.length === 1 ? 'is' : 'are'} open.`
    }
  }

  const results: Compaction[] = []

  for (const { path } of DATABASES) results.push(await compact(path))

  const tally = (result: Compaction): number => results.filter((each) => each === result).length

  if (tally('compacted') > 0) {
    return {
      status: 'applied',
      message: `Compacted ${plural(tally('compacted'), 'database', 'databases')}.`
    }
  }

  if (tally('denied') > 0) return { status: 'skipped', message: FULL_DISK_ACCESS }

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

const LOGIN_ITEMS = `tell application "System Events"
  set listing to ""
  repeat with loginItem in login items
    set listing to listing & (name of loginItem) & tab & (path of loginItem) & linefeed
  end repeat
end tell
return listing`

// An app that moved still opens at login, so Spotlight looks for it by name before it counts as gone.
async function findable(name: string): Promise<boolean> {
  if (name.includes("'") || name.includes('\\')) return true

  const found = await output('/usr/bin/mdfind', [`kMDItemFSName == '${name}.app'`], 5000)

  return found.trim() !== ''
}

export async function loginItems(): Promise<OptimizeOutcome> {
  // The first run waits on the user to answer macOS's prompt to let eggy control System Events.
  const ran = await exec('/usr/bin/osascript', ['-e', LOGIN_ITEMS], 120_000)

  // -1743 is AppleScript's "Not authorized to send Apple events".
  if (ran.stderr.includes('(-1743)')) {
    return {
      status: 'skipped',
      message: 'Needs permission to control System Events, under Automation in System Settings.'
    }
  }

  if (ran.timedOut) throw new Error("System Events didn't list login items within two minutes.")

  if (ran.code !== 0) throw new Error(ran.stderr.trim() || "Couldn't list login items.")

  const items = ran.stdout.split('\n').flatMap((line) => {
    const [name, path] = line.split('\t')

    return path === undefined ? [] : [{ name, path }]
  })

  if (items.length === 0) return { status: 'unchanged', message: 'No login items.' }

  const gone: string[] = []

  for (const { name, path } of items) {
    if (!(await exists(path)) && !(await findable(name))) gone.push(name)
  }

  if (gone.length === 0) {
    return {
      status: 'unchanged',
      message: `All ${plural(items.length, 'login item', 'login items')} open existing apps.`
    }
  }

  return {
    status: 'attention',
    message:
      gone.length === 1
        ? `${gone[0]} opens at login, but its app is gone.`
        : `${list.format(gone)} open at login, but their apps are gone.`,
    review: 'loginItems'
  }
}

async function programOf(plist: string): Promise<string | undefined> {
  for (const key of ['Program', 'ProgramArguments.0']) {
    const ran = await exec('/usr/bin/plutil', ['-extract', key, 'raw', '-o', '-', plist], 5000)

    if (ran.code === 0 && ran.stdout.trim() !== '') return ran.stdout.trim()
  }

  return undefined
}

// A program on a disk that isn't mounted right now isn't gone.
async function missing(program: string): Promise<boolean> {
  const volume = /^\/Volumes\/[^/]+/.exec(program)?.[0]

  if (volume !== undefined && !(await exists(volume))) return false

  return !(await exists(program))
}

export async function launchAgents(): Promise<OptimizeOutcome> {
  const folder = join(home, 'Library/LaunchAgents')
  const plists = (await entries(folder)).filter((name) => name.endsWith('.plist'))

  if (plists.length === 0) return { status: 'unchanged', message: 'No launch agents.' }

  const gone: string[] = []

  for (const name of plists) {
    const program = await programOf(join(folder, name))

    // A bare name runs whatever the PATH finds, so only an absolute path can be shown to be gone.
    if (program?.startsWith('/') && (await missing(program))) {
      gone.push(basename(name, '.plist'))
    }
  }

  if (gone.length === 0) {
    return { status: 'unchanged', message: "Every launch agent's program exists." }
  }

  return {
    status: 'attention',
    message:
      gone.length === 1
        ? `${gone[0]} runs a program that is gone.`
        : `${plural(gone.length, 'launch agent runs', 'launch agents run')} programs that are gone.`,
    review: 'launchAgents'
  }
}
