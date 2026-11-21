import type { Failure } from './failure'

export type Commit = {
  hash: string
  subject: string
  author: string
  date: number
  url: string | undefined
}

export type History = {
  unpushed: Commit[]
  pushed: Commit[]
}

export type Sync = {
  ahead: number
  behind: number
}

export type Tracking = {
  remote: string
  sync: Sync | undefined
  history: History
}

export type Repo = Tracking & {
  path: string
  commonDir: string
  branch: string
  upstream: string
}

export type FetchOutcome = { status: 'fetched' } | Failure

export type FetchResult = { tracking: Tracking; outcome: FetchOutcome }

export type PullCommand = 'pull' | 'rebase'

export type PullOutcome = { status: 'current' } | { status: 'updated'; count: number } | Failure

export type PullResult = { tracking: Tracking; outcome: PullOutcome }

export type CommitDetail = {
  body: string
  patch: string
}
