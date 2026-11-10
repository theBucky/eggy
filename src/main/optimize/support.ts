import { open, readdir, stat } from 'node:fs/promises'
import type { OptimizeOutcome } from '$shared/api'
import { errorCode } from '../errors'
import { checked, exec } from '../exec'

// Resolves to `undefined` when another process holds the database for longer than sqlite waits.
// sqlite stops at the first failing statement, after the ones before it have committed. An empty
// init file keeps the user's ~/.sqliterc from changing the output format.
export async function sqlite(
  database: string,
  statements: string[],
  timeout: number
): Promise<string | undefined> {
  const ran = await exec(
    '/usr/bin/sqlite3',
    ['-init', '/dev/null', database, '.timeout 5000', ...statements],
    { timeout }
  )

  if (/database is (locked|busy)/.test(ran.stderr)) return undefined

  return checked(ran).trim()
}

// Privacy protections refuse to open files under some folders with EPERM until the app has Full Disk
// Access, unlike file permissions, which refuse with EACCES.
export async function access(
  path: string
): Promise<'readable' | 'missing' | 'denied' | 'unreadable'> {
  try {
    await (await open(path, 'r')).close()

    return 'readable'
  } catch (cause) {
    const code = errorCode(cause)

    if (code === 'ENOENT') return 'missing'

    if (code === 'EPERM') return 'denied'

    if (code === 'EACCES') return 'unreadable'

    throw cause
  }
}

export const NEEDS_FULL_DISK_ACCESS = {
  status: 'skipped',
  message: 'Needs Full Disk Access in System Settings.'
} as const satisfies OptimizeOutcome

export async function entries(folder: string): Promise<string[]> {
  try {
    return await readdir(folder)
  } catch (cause) {
    if (errorCode(cause) === 'ENOENT') return []

    throw cause
  }
}

// Follows symlinks, so a link whose target is gone doesn't count.
export async function exists(path: string): Promise<boolean> {
  try {
    await stat(path)

    return true
  } catch (cause) {
    if (errorCode(cause) === 'ENOENT') return false

    throw cause
  }
}

// plutil exits with 1 when a file doesn't parse, and passes a batch only when every file in it does.
async function parses(paths: string[]): Promise<boolean> {
  const ran = await exec('/usr/bin/plutil', ['-lint', '-s', ...paths], { timeout: 30_000 })

  if (ran.exit === 1) return false

  checked(ran)

  return true
}

// A missing or unreadable file can't be shown to be broken, so it stays.
export async function broken(paths: string[]): Promise<string[]> {
  const found: string[] = []

  for (let start = 0; start < paths.length; start += 256) {
    const batch = paths.slice(start, start + 256)

    if (await parses(batch)) continue

    for (const path of batch) {
      if ((await access(path)) === 'readable' && !(await parses([path]))) found.push(path)
    }
  }

  return found
}
