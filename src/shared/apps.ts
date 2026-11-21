import type { Failure } from './failure'

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

export type UpgradeOutcome = InstallOutcome | { status: 'discarded' }

export type Progress =
  | { stage: 'download'; percent: number | undefined }
  | { stage: 'install' }
  | { stage: 'waiting' }
