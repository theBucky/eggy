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

export type CheckOutcome =
  | { status: 'current' }
  | { status: 'outdated'; release: Release }
  | Failure

export type InstallOutcome = { status: 'upgraded'; version: string; build: string } | Failure

export type UpgradeOutcome = InstallOutcome | { status: 'discarded' }

export type Progress =
  | { stage: 'download'; percent: number | undefined }
  | { stage: 'install' }
  | { stage: 'waiting' }

export type Requests = {
  listApps: () => App[]
  checkApp: (path: string) => CheckOutcome
  upgradeApp: (path: string) => UpgradeOutcome
  answerAppQuit: (path: string, quit: boolean) => void
}

export type Events = {
  appProgress: [path: string, progress: Progress]
}
