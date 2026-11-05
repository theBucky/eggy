export type Commit = {
  hash: string
  subject: string
  author: string
  // Committer date in milliseconds since the epoch.
  date: number
}

// Up to ten of each kind, newest first.
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
  // Shared by linked worktrees of the same repository.
  gitDir: string
  branch: string
  upstream: string
  remote: string
  // A commit's web page is this URL followed by its hash; missing for remotes without a web host,
  // such as local paths.
  commitUrl: string | undefined
  // Missing while the upstream ref is absent locally, such as before a first fetch or after a prune.
  sync: Sync | undefined
  // The local branch's latest commits; empty once the repo can no longer be read.
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

// An app that updates itself through a Sparkle feed.
export type App = {
  path: string
  name: string
  // CFBundleShortVersionString, shown to people.
  version: string
  // CFBundleVersion, which Sparkle compares against the feed.
  build: string
  feed: string
  // A PNG data URL.
  icon: string
}

export type Notes =
  | { format: 'html' | 'markdown' | 'plain-text'; text: string }
  | { format: 'link'; url: string }

export type Release = {
  version: string
  build: string
  // Milliseconds since the epoch; missing when the feed leaves out or garbles the date.
  date: number | undefined
  url: string
  // In bytes, as the feed declares.
  size: number | undefined
  notes: Notes | undefined
}

// The update is the feed's newest release for this Mac, missing once the app runs it or newer.
export type CheckOutcome = { status: 'checked'; update: Release | undefined } | Failure

// Carries the versions the replaced app reports.
export type InstallOutcome = { status: 'updated'; version: string; build: string } | Failure

// A running app keeps its update waiting until the user allows the force quit or drops it.
export type UpdateOutcome = InstallOutcome | { status: 'waiting' }

// The whole percent downloaded is missing while the size is unknown.
export type Progress = { stage: 'download'; percent: number | undefined } | { stage: 'install' }

export type Ipc = {
  chooseRoot: (current: string) => Promise<string | undefined>
  scan: (root: string) => Promise<Repo[]>
  fetch: (path: string) => Promise<FetchResult>
  pull: (path: string, command: PullCommand) => Promise<PullResult>
  listApps: () => Promise<App[]>
  check: (path: string) => Promise<CheckOutcome>
  update: (path: string) => Promise<UpdateOutcome>
  // Force quits the app and installs its waiting update.
  forceUpdate: (path: string) => Promise<InstallOutcome>
  discardUpdate: (path: string) => Promise<void>
}

export type Api = Ipc & {
  home: string
  onProgress: (listener: (path: string, progress: Progress) => void) => void
}
