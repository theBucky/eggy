import { execFile } from 'node:child_process'
import { open, readdir, stat } from 'node:fs/promises'
import * as z from 'zod'

type Ran = { code: number | undefined; timedOut: boolean; stdout: string; stderr: string }

const Status = z.object({ code: z.number() })

export function exec(file: string, args: string[], timeout: number): Promise<Ran> {
  return new Promise((resolve) => {
    execFile(file, args, { timeout, maxBuffer: Infinity }, (error, stdout, stderr) => {
      const code = error === null ? 0 : Status.safeParse(error).data?.code

      resolve({ code, timedOut: error?.killed === true, stdout, stderr })
    })
  })
}

function checked(file: string, timeout: number, ran: Ran): string {
  if (ran.timedOut) throw new Error(`${file} took longer than ${timeout / 1000} seconds.`)

  if (ran.code !== 0) throw new Error(ran.stderr.trim() || `${file} failed.`)

  return ran.stdout
}

export async function output(file: string, args: string[], timeout: number): Promise<string> {
  return checked(file, timeout, await exec(file, args, timeout))
}

const SQLITE = '/usr/bin/sqlite3'

// Resolves to `undefined` when another process holds the database for longer than sqlite waits.
// sqlite stops at the first failing statement, after the ones before it have committed. An empty
// init file keeps the user's ~/.sqliterc from changing the output format.
export async function sqlite(
  database: string,
  statements: string[],
  timeout: number
): Promise<string | undefined> {
  const ran = await exec(
    SQLITE,
    ['-init', '/dev/null', database, '.timeout 5000', ...statements],
    timeout
  )

  if (/database is (locked|busy)/.test(ran.stderr)) return undefined

  return checked(SQLITE, timeout, ran).trim()
}

const Code = z.object({ code: z.enum(['ENOENT', 'EPERM', 'EACCES']) })

export function errorCode(cause: unknown): 'ENOENT' | 'EPERM' | 'EACCES' | undefined {
  return Code.safeParse(cause).data?.code
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

    if (code === undefined) throw cause

    return ({ ENOENT: 'missing', EPERM: 'denied', EACCES: 'unreadable' } as const)[code]
  }
}

export const FULL_DISK_ACCESS = 'Needs Full Disk Access in System Settings.'

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

const PLUTIL = '/usr/bin/plutil'

// plutil exits with 1 when a file doesn't parse, and passes a batch only when every file in it does.
async function parses(paths: string[]): Promise<boolean> {
  const ran = await exec(PLUTIL, ['-lint', '-s', ...paths], 30_000)

  if (ran.code === 1) return false

  checked(PLUTIL, 30_000, ran)

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
