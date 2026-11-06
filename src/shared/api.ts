export type Commit = {
  hash: string
  subject: string
  author: string
  date: number
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

export type Repo = {
  path: string
  gitDir: string
  branch: string
  upstream: string
  remote: string
  commitUrl: string | undefined
  sync: Sync | undefined
  history: History
}

export type Failure = { status: 'failed'; message: string }

export type FetchOutcome = { status: 'fetched' } | Failure

export type PullCommand = 'pull' | 'rebase'

export type PullOutcome = { status: 'current' } | { status: 'updated'; count: number } | Failure

export type FetchResult = {
  sync: Sync | undefined
  outcome: FetchOutcome
}

export type PullResult = {
  sync: Sync | undefined
  history: History
  outcome: PullOutcome
}

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

export type CheckOutcome = { status: 'checked'; update: Release | undefined } | Failure

export type InstallOutcome = { status: 'updated'; version: string; build: string } | Failure

export type UpdateOutcome = InstallOutcome | { status: 'waiting' }

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
  update: (path: string) => Promise<UpdateOutcome>
  forceUpdate: (path: string) => Promise<InstallOutcome>
  discardUpdate: (path: string) => Promise<void>
}

export type Api = Ipc & {
  home: string
  onProgress: (listener: (path: string, progress: Progress) => void) => void
}
