import { statfs } from 'node:fs/promises'
import { totalmem, uptime } from 'node:os'
import type { Machine } from '$shared/api'
import { output } from '../exec'

// Counts memory the way Activity Monitor's "Memory Used" does: app memory, wired, and compressed.
async function memoryUsed(): Promise<number> {
  const stats = await output('/usr/bin/vm_stat', [], { timeout: 5000 })

  function read(pattern: RegExp, label: string): number {
    const match = pattern.exec(stats)

    if (match === null) throw new Error(`vm_stat no longer reports ${label}.`)

    return Number(match[1])
  }

  const pageSize = read(/page size of (\d+) bytes/, 'its page size')

  function pages(label: string): number {
    return read(new RegExp(`^${label}:\\s+(\\d+)\\.$`, 'm'), `"${label}"`)
  }

  const app = pages('Anonymous pages') - pages('Pages purgeable')

  return (app + pages('Pages wired down') + pages('Pages occupied by compressor')) * pageSize
}

export async function inspectMachine(): Promise<Machine> {
  // Every APFS volume in the container shares its free space.
  const [used, disk] = await Promise.all([memoryUsed(), statfs('/')])

  return {
    memory: { used, total: totalmem() },
    disk: { free: disk.bavail * disk.bsize, total: disk.blocks * disk.bsize },
    uptime: uptime() * 1000
  }
}
