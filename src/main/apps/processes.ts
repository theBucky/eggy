import { setTimeout as sleep } from 'node:timers/promises'
import { errorCode } from '../errors'
import { output } from '../exec'
import type { Bundle } from './bundle'

// Bundles can also ship CLI tools whose processes must stay running.
async function pidsOf({ executable }: Bundle): Promise<number[]> {
  const lines = (await output('/bin/ps', ['-axo', 'pid=,comm='])).split('\n')

  return lines.flatMap((line) => {
    const [, pid, command] = /^\s*(\d+) (.+)$/.exec(line) ?? []

    return command === executable ? [Number(pid)] : []
  })
}

export async function isRunning(bundle: Bundle): Promise<boolean> {
  return (await pidsOf(bundle)).length > 0
}

// The app can exit on its own between listing and killing.
function kill(pid: number): void {
  try {
    process.kill(pid, 'SIGKILL')
  } catch (cause) {
    if (errorCode(cause) !== 'ESRCH') throw cause
  }
}

// Each pass also catches an instance that launchd restarts.
export async function forceQuit(bundle: Bundle): Promise<boolean> {
  for (let pass = 0; pass < 20; pass++) {
    const pids = await pidsOf(bundle)

    if (pids.length === 0) return pass > 0

    for (const pid of pids) kill(pid)

    await sleep(100)
  }

  throw new Error(`${bundle.name} keeps relaunching, so it can't be replaced.`)
}
