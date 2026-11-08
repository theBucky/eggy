import { homedir } from 'node:os'
import { join } from 'node:path'
import { shell } from 'electron'
import {
  isPrivileged,
  type Optimization,
  type OptimizeOutcome,
  type OptimizeState,
  type Privileged,
  type Review
} from '../../shared/api'
import { appDatabases, launchAgents, loginItems, preferences, savedStates } from './applications'
import { networkVolumes, quickLook, sharedFileLists } from './finder'
import { dnsCache, networkStack } from './network'
import { runAsRoot, type Exit, type Plan } from './root'
import { notifications, quarantine, spotlight } from './system'

export { inspectMachine } from './machine'

type Report = (optimization: Optimization, state: OptimizeState) => void

const TASKS: Record<Exclude<Optimization, Privileged>, () => Promise<OptimizeOutcome>> = {
  savedStates,
  preferences,
  appDatabases,
  loginItems,
  launchAgents,
  quickLook,
  sharedFileLists,
  networkVolumes,
  notifications,
  quarantine
}

const ROOT_TASKS: Record<Privileged, () => Promise<OptimizeOutcome | Plan>> = {
  dnsCache,
  networkStack,
  spotlight
}

function failure(cause: unknown): OptimizeOutcome {
  return { status: 'failed', message: cause instanceof Error ? cause.message : String(cause) }
}

async function settle<T>(task: () => Promise<T>): Promise<T | OptimizeOutcome> {
  try {
    return await task()
  } catch (cause) {
    return failure(cause)
  }
}

async function runPrivileged(optimizations: Privileged[], report: Report): Promise<void> {
  for (const optimization of optimizations) report(optimization, { status: 'running' })

  const planned: { optimization: Privileged; plan: Plan }[] = []

  for (const optimization of optimizations) {
    const plan = await settle(ROOT_TASKS[optimization])

    if ('script' in plan) planned.push({ optimization, plan })
    else report(optimization, plan)
  }

  if (planned.length === 0) return

  const names = planned.length === 1 ? 'an optimization' : `${planned.length} optimizations`

  let exits: Exit[] | undefined

  try {
    exits = await runAsRoot(
      planned.map(({ plan }) => plan.script),
      `eggy needs an administrator to run ${names}.`
    )
  } catch (cause) {
    for (const { optimization } of planned) report(optimization, failure(cause))

    return
  }

  planned.forEach(({ optimization, plan }, index) => {
    report(
      optimization,
      exits === undefined
        ? { status: 'skipped', message: 'Administrator access was not granted.' }
        : plan.interpret(exits[index])
    )
  })
}

// Asking for the password first keeps the prompt next to the click that caused it.
export async function run(optimizations: Optimization[], report: Report): Promise<void> {
  const privileged = optimizations.filter(isPrivileged)

  if (privileged.length > 0) await runPrivileged(privileged, report)

  for (const optimization of optimizations) {
    if (isPrivileged(optimization)) continue

    report(optimization, { status: 'running' })
    report(optimization, await settle(TASKS[optimization]))
  }
}

export async function review(target: Review): Promise<void> {
  if (target === 'loginItems') {
    await shell.openExternal('x-apple.systempreferences:com.apple.LoginItems-Settings.extension')
  } else {
    await shell.openPath(join(homedir(), 'Library/LaunchAgents'))
  }
}
