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
  // Missing while the upstream ref is absent locally, such as before a first fetch or after a prune.
  sync: Sync | undefined
}

export type Commit = {
  hash: string
  subject: string
  author: string
  date: string
}

export type Failure = { status: 'failed'; message: string }

export type FetchOutcome = { status: 'fetched' } | Failure

export type PullOutcome = { status: 'current' } | { status: 'updated'; commits: Commit[] } | Failure

export type Result<Outcome> = {
  sync: Sync | undefined
  outcome: Outcome
}

export type Api = {
  home: string
  chooseRoot: (current: string) => Promise<string | undefined>
  scan: (root: string) => Promise<Repo[]>
  fetch: (path: string) => Promise<Result<FetchOutcome>>
  pull: (path: string) => Promise<Result<PullOutcome>>
}
