import { failure } from '$platform/errors'
import type { Handlers, Send } from '$platform/ipc'
import {
  isPrivileged,
  type Events,
  type Optimization,
  type OptimizeOutcome,
  type OptimizeState,
  type Privileged,
  type Requests
} from '$shared/optimize'
import { appDatabases, preferences, savedStates } from './applications'
import { networkVolumes, quickLook, sharedFileLists } from './finder'
import { inspectMachine } from './machine'
import { dnsCache, networkStack } from './network'
import { runAsRoot, type Plan, type Prepared } from './root'
import { launchAgents, loginItems, review } from './startup'
import { notifications, quarantine, spotlight } from './system'

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

const ROOT_TASKS: Record<Privileged, () => Promise<Prepared>> = {
  dnsCache,
  networkStack,
  spotlight
}

async function runPrivileged(optimizations: Privileged[], report: Report): Promise<void> {
  for (const optimization of optimizations) report(optimization, { status: 'running' })

  const planned: { optimization: Privileged; plan: Plan }[] = []

  for (const optimization of optimizations) {
    const prepared = await ROOT_TASKS[optimization]().catch(failure)

    if ('script' in prepared) planned.push({ optimization, plan: prepared })
    else report(optimization, prepared)
  }

  if (planned.length === 0) return

  const plans = planned.map(({ plan }) => plan)
  const outcomes = await runAsRoot(plans).catch((cause) => plans.map(() => failure(cause)))

  planned.forEach(({ optimization }, index) => report(optimization, outcomes[index]))
}

async function run(optimizations: Optimization[], report: Report): Promise<void> {
  await runPrivileged(optimizations.filter(isPrivileged), report)

  for (const optimization of optimizations) {
    if (isPrivileged(optimization)) continue

    report(optimization, { status: 'running' })
    report(optimization, await TASKS[optimization]().catch(failure))
  }
}

export function handlers(send: Send<Events>): Handlers<Requests> {
  return {
    inspectMachine: () => inspectMachine(),
    optimize: (_, optimizations) =>
      run(optimizations, (optimization, state) => send('optimization', optimization, state)),
    review: (_, target) => review(target)
  }
}
