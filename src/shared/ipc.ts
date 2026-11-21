import type { App, CheckOutcome, InstallOutcome, Progress, UpgradeOutcome } from './apps'
import type { Machine, Optimization, OptimizeState, Review } from './optimize'
import type { PackageCheck, PackageKind, PackageList, PackageUpgrade } from './packages'
import type { CommitDetail, FetchResult, PullCommand, PullResult, Repo } from './repos'
import type { Theme } from './theme'

export type MenuCommand = 'settings' | 'refresh'

export type Requests = {
  chooseRoot: (current: string) => string | undefined
  scanRepos: (root: string) => Repo[]
  fetchRepo: (path: string) => FetchResult
  pullRepo: (path: string, command: PullCommand) => PullResult
  showCommit: (path: string, hash: string) => CommitDetail
  planWindowExpansion: (width: number) => number
  planWindowCollapse: () => number
  moveWindow: () => void
  listApps: () => App[]
  checkApp: (path: string) => CheckOutcome
  upgradeApp: (path: string) => UpgradeOutcome
  forceAppUpgrade: (path: string) => InstallOutcome
  discardAppUpgrade: (path: string) => void
  listPackages: () => PackageList
  checkPackages: () => PackageCheck
  upgradePackage: (kind: PackageKind, fullName: string) => PackageUpgrade
  setTheme: (theme: Theme) => void
  inspectMachine: () => Machine
  optimize: (optimizations: Optimization[]) => void
  review: (target: Review) => void
}

export type Events = {
  appProgress: [path: string, progress: Progress]
  packageOutput: [kind: PackageKind, fullName: string, text: string]
  optimization: [optimization: Optimization, state: OptimizeState]
  menuCommand: [command: MenuCommand]
}

// What the preload reads synchronously, before the page renders.
export type Launch = {
  home: string
  theme: Theme
}

export type Api = Launch & {
  invoke: <Channel extends keyof Requests>(
    channel: Channel,
    ...args: Parameters<Requests[Channel]>
  ) => Promise<ReturnType<Requests[Channel]>>
  on: <Channel extends keyof Events>(
    channel: Channel,
    listener: (...args: Events[Channel]) => void
  ) => void
}
