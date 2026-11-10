export type Commit = {
  hash: string
  subject: string
  author: string
  date: number
  url: string | undefined
}

export type CommitDetail = {
  body: string
  patch: string
}

export type History = {
  unpushed: Commit[]
  pushed: Commit[]
}

export type Sync = {
  ahead: number
  behind: number
}

// What a repo knows about its upstream, which every scan, fetch, and pull reads afresh.
export type Tracking = {
  remote: string
  sync: Sync | undefined
  history: History
}

export type Repo = Tracking & {
  path: string
  gitDir: string
  branch: string
  upstream: string
}

export type Failure = { status: 'failed'; message: string }

export type FetchOutcome = { status: 'fetched' } | Failure

export type PullCommand = 'pull' | 'rebase'

export type PullOutcome = { status: 'current' } | { status: 'updated'; count: number } | Failure

export type FetchResult = Tracking & { outcome: FetchOutcome }

export type PullResult = Tracking & { outcome: PullOutcome }

export type App = {
  path: string
  name: string
  version: string
  build: string
  feed: string
  icon: string
}

export type Notes =
  | { format: 'html' | 'markdown' | 'plain-text'; text: string }
  | { format: 'link'; url: string }

export type Release = {
  version: string
  build: string
  date: number | undefined
  url: string
  size: number | undefined
  notes: Notes | undefined
}

export type CheckOutcome = { status: 'checked'; release: Release | undefined } | Failure

export type InstallOutcome = { status: 'upgraded'; version: string; build: string } | Failure

export type UpgradeOutcome = InstallOutcome | { status: 'waiting' }

export type Progress = { stage: 'download'; percent: number | undefined } | { stage: 'install' }

export type PackageKind = 'formula' | 'cask'

export type Package = {
  kind: PackageKind
  name: string
  // Includes the tap for packages outside Homebrew's own, which brew needs to tell them apart.
  fullName: string
  description: string | undefined
  homepage: string | undefined
  tap: string | undefined
  version: string
  latest: string
  requested: boolean
  state: 'pinned' | 'outdated' | 'current'
}

export type PackageList =
  | { status: 'listed'; packages: Package[] }
  | { status: 'missing' }
  | Failure

export type PackageUpgrade = { status: 'upgraded' } | Failure

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

export const THEMES = ['system', 'light', 'dark'] as const

export type Theme = (typeof THEMES)[number]

export type Ipc = {
  chooseRoot: (current: string) => Promise<string | undefined>
  scanRepos: (root: string) => Promise<Repo[]>
  fetchRepo: (path: string) => Promise<FetchResult>
  pullRepo: (path: string, command: PullCommand) => Promise<PullResult>
  showCommit: (path: string, hash: string) => Promise<CommitDetail>
  planWindowExpansion: (width: number) => Promise<number>
  planWindowCollapse: () => Promise<number>
  moveWindow: () => Promise<void>
  listApps: () => Promise<App[]>
  checkApp: (path: string) => Promise<CheckOutcome>
  upgradeApp: (path: string) => Promise<UpgradeOutcome>
  forceAppUpgrade: (path: string) => Promise<InstallOutcome>
  discardAppUpgrade: (path: string) => Promise<void>
  listPackages: () => Promise<PackageList>
  checkPackages: () => Promise<PackageList>
  upgradePackage: (kind: PackageKind, fullName: string) => Promise<PackageUpgrade>
  setTheme: (theme: Theme) => Promise<void>
  inspectMachine: () => Promise<Machine>
  optimize: (optimizations: Optimization[]) => Promise<void>
  review: (target: Review) => Promise<void>
}

export type Events = {
  appProgress: [path: string, progress: Progress]
  packageOutput: [kind: PackageKind, fullName: string, text: string]
  optimization: [optimization: Optimization, state: OptimizeState]
}

export type Api = Ipc & {
  home: string
  theme: Theme
  onAppProgress: (listener: (...args: Events['appProgress']) => void) => void
  onPackageOutput: (listener: (...args: Events['packageOutput']) => void) => void
  onOptimization: (listener: (...args: Events['optimization']) => void) => void
}
