import type { Failure } from './failure'

export const OPTIMIZATIONS = [
  'savedStates',
  'preferences',
  'appDatabases',
  'loginItems',
  'launchAgents',
  'quickLook',
  'sharedFileLists',
  'networkVolumes',
  'dnsCache',
  'networkStack',
  'spotlight',
  'notifications',
  'quarantine'
] as const

export type Optimization = (typeof OPTIMIZATIONS)[number]

export const PRIVILEGED = [
  'dnsCache',
  'networkStack',
  'spotlight'
] as const satisfies readonly Optimization[]

export type Privileged = (typeof PRIVILEGED)[number]

export function isPrivileged(optimization: Optimization): optimization is Privileged {
  return PRIVILEGED.some((candidate) => candidate === optimization)
}

export type Review = 'loginItems' | 'launchAgents'

export type OptimizeOutcome =
  | { status: 'applied' | 'unchanged' | 'skipped' | 'unavailable'; message: string }
  | { status: 'attention'; message: string; review: Review }
  | Failure

export type OptimizeState = { status: 'running' } | OptimizeOutcome

export type Machine = {
  memory: { used: number; total: number }
  disk: { free: number; total: number }
  uptime: number
}

export type Requests = {
  inspectMachine: () => Machine
  optimize: (optimizations: Optimization[]) => void
  review: (target: Review) => void
}

export type Events = {
  optimization: [optimization: Optimization, state: OptimizeState]
}
