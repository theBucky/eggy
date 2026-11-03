export type Commit = {
  hash: string
  subject: string
  author: string
  // Committer date in milliseconds since the epoch.
  date: number
  unpushed: boolean
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
  // The local branch's latest commits, newest first; empty once the repo can no longer be read.
  history: Commit[]
}

export type Failure = { status: 'failed'; message: string }

export type FetchOutcome = { status: 'fetched' } | Failure

export type PullOutcome = { status: 'current' } | { status: 'updated'; count: number } | Failure

export type FetchResult = {
  sync: Sync | undefined
  outcome: FetchOutcome
}

export type PullResult = {
  sync: Sync | undefined
  history: Commit[]
  outcome: PullOutcome
}

export type Ipc = {
  chooseRoot: (current: string) => Promise<string | undefined>
  scan: (root: string) => Promise<Repo[]>
  fetch: (path: string) => Promise<FetchResult>
  pull: (path: string) => Promise<PullResult>
}

export type Api = Ipc & { home: string }
