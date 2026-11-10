import { stat } from 'node:fs/promises'
import { homedir, userInfo } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import type { OptimizeOutcome } from '$shared/api'
import { plural } from '$shared/plural'
import { exec, output } from '../exec'
import { command, guarded, type Guard, type Prepared } from './root'
import { NEEDS_FULL_DISK_ACCESS, access, sqlite } from './support'

const home = homedir()

async function slow(): Promise<boolean> {
  const started = performance.now()
  const ran = await exec('/usr/bin/mdfind', ["kMDItemFSName == 'Applications'"], { timeout: 5000 })

  if (ran.exit === 'timeout') return true

  if (ran.exit !== 0) throw new Error(ran.stderr.trim() || "Spotlight couldn't search.")

  return performance.now() - started > 3000
}

const AC_POWER: Guard = {
  check: `/usr/bin/pmset -g batt | /usr/bin/grep -q "'AC Power'"`,
  stopped: { status: 'skipped', message: 'Skipped on battery power.' }
}

// A rebuild reindexes the whole disk for hours, so it only starts when two searches in a row stall.
export async function spotlight(): Promise<Prepared> {
  const status = await output('/usr/bin/mdutil', ['-s', '/'], { timeout: 3000 })

  if (!/Indexing enabled/.test(status)) {
    return { status: 'skipped', message: 'Spotlight indexing is off.' }
  }

  return guarded(AC_POWER, async () => {
    const unchanged = { status: 'unchanged', message: 'Search responds normally.' } as const

    if (!(await slow())) return unchanged

    await sleep(1000)

    if (!(await slow())) return unchanged

    return {
      script: command('/usr/bin/mdutil', '-E', '/'),
      interpret: ({ code, printed }) =>
        code === 0
          ? { status: 'applied', message: 'Rebuilding the index, which takes a few hours.' }
          : { status: 'failed', message: printed || "Couldn't rebuild the Spotlight index." }
    }
  })
}

// Delivery dates count seconds from 2001, not 1970.
const RECORDS = `DELETE FROM record WHERE delivered_date < strftime('%s', 'now', '-30 days') - 978307200;`

export async function notifications(): Promise<OptimizeOutcome> {
  const database = join(home, 'Library/Group Containers/group.com.apple.usernoted/db2/db')
  const readable = await access(database)

  if (readable === 'missing') {
    return { status: 'unavailable', message: 'Notification Center keeps no database.' }
  }

  if (readable === 'denied') return NEEDS_FULL_DISK_ACCESS

  if ((await stat(database)).size < 50 * 2 ** 20) {
    return { status: 'unchanged', message: 'The database is under 50 MB.' }
  }

  const deleted = await sqlite(database, [RECORDS, 'SELECT changes();'], 30_000)
  const busy = { status: 'skipped', message: 'Notification Center is using its database.' } as const

  if (deleted === undefined) return busy

  const removed = Number(deleted)
  const compacted = (await sqlite(database, ['VACUUM;'], 60_000)) !== undefined

  if (removed === 0 && !compacted) return busy

  // The agent reloads the trimmed database when launchd restarts it. A missing or stopped agent
  // reloads it on its next start, so its answer doesn't matter.
  await exec(
    '/bin/launchctl',
    ['kill', 'SIGTERM', `gui/${userInfo().uid}/com.apple.notificationcenterui.agent`],
    { timeout: 5000 }
  )

  return {
    status: 'applied',
    message:
      removed > 0
        ? `Removed ${plural(removed, 'old notification', 'old notifications')}.`
        : 'Compacted the notification database.'
  }
}

export async function quarantine(): Promise<OptimizeOutcome> {
  const database = join(home, 'Library/Preferences/com.apple.LaunchServices.QuarantineEventsV2')
  const readable = await access(database)

  if (readable === 'missing') return { status: 'unchanged', message: 'No download history.' }

  if (readable === 'denied') return NEEDS_FULL_DISK_ACCESS

  // secure_delete zeroes the records instead of leaving them readable in free pages, and prints its
  // new value before the count.
  const cleared = await sqlite(
    database,
    ['PRAGMA secure_delete = ON;', 'DELETE FROM LSQuarantineEvent;', 'SELECT changes();'],
    10_000
  )

  if (cleared === undefined) {
    return { status: 'skipped', message: 'macOS is writing to the download history.' }
  }

  const count = Number(cleared.split('\n').at(-1))

  if (count === 0) return { status: 'unchanged', message: 'No download history.' }

  return {
    status: 'applied',
    message: `Cleared ${plural(count, 'download record', 'download records')}.`
  }
}
