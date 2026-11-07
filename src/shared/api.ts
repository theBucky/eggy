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

export type Ipc = {
  chooseRoot: (current: string) => Promise<string | undefined>
  scan: (root: string) => Promise<Repo[]>
  fetch: (path: string) => Promise<FetchResult>
  pull: (path: string, command: PullCommand) => Promise<PullResult>
  show: (path: string, hash: string) => Promise<CommitDetail>
  expandWindow: (width: number) => Promise<number>
  collapseWindow: () => Promise<number>
  moveWindow: () => Promise<void>
  listApps: () => Promise<App[]>
  check: (path: string) => Promise<CheckOutcome>
  upgrade: (path: string) => Promise<UpgradeOutcome>
  forceUpgrade: (path: string) => Promise<InstallOutcome>
  discardUpgrade: (path: string) => Promise<void>
}

export type Events = {
  progress: [path: string, progress: Progress]
}

export type Api = Ipc & {
  home: string
  onProgress: (listener: (...args: Events['progress']) => void) => void
}
