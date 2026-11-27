import { invoke, on } from '$client/api'
import type { App, Progress, Release } from '$shared/apps'
import type { Failure } from '$shared/failure'
import { Source } from '$source/source.svelte'
import type { Status } from '$source/status'
import { QuitPrompt } from './quit-prompt.svelte'

type Upgrade = { status: 'running'; progress: Progress } | Failure

export type Standing =
  | { status: 'checking' | 'current' | 'upgraded' }
  | { status: 'outdated'; release: Release; upgrade?: Upgrade }
  | Failure

export type Entry = {
  id: string
  app: App
  standing?: Standing
}

export function releaseOf({ standing }: Entry): Release | undefined {
  return standing?.status === 'outdated' ? standing.release : undefined
}

function upgradeOf({ standing }: Entry): Upgrade | undefined {
  return standing?.status === 'outdated' ? standing.upgrade : undefined
}

export function progressOf(entry: Entry): Progress | undefined {
  const upgrade = upgradeOf(entry)

  return upgrade?.status === 'running' ? upgrade.progress : undefined
}

export function failureOf(entry: Entry): Failure | undefined {
  const upgrade = upgradeOf(entry)

  if (upgrade?.status === 'failed') return upgrade

  return entry.standing?.status === 'failed' ? entry.standing : undefined
}

export function labelOf({ version, build }: App | Release): string {
  return version === build ? version : `${version} (${build})`
}

export class Apps extends Source<Entry> {
  readonly prompt = new QuitPrompt()
  checked = $derived(
    this.entries.some(({ standing }) => standing !== undefined && standing.status !== 'checking')
  )
  checkFailed = $derived(this.entries.some(({ standing }) => standing?.status === 'failed'))
  outdated = $derived(this.entries.filter(releaseOf))

  constructor() {
    super()
    on('appProgress', (path, progress) => {
      const entry = this.find(path)

      if (entry?.standing?.status !== 'outdated') return

      if (entry.standing.upgrade?.status !== 'running') return

      entry.standing.upgrade.progress = progress

      if (progress.stage === 'waiting') {
        this.prompt.ask(entry.app).then((quit) => invoke('answerAppQuit', path, quit))
      }
    })
  }

  statusOf({ standing }: Entry): Status {
    if (standing === undefined) return 'unknown'

    if (standing.status === 'checking') return 'running'

    if (standing.status === 'outdated') return standing.upgrade?.status ?? 'outdated'

    return standing.status === 'failed' ? 'failed' : 'current'
  }

  async upgrade(entries: Entry[]): Promise<void> {
    await Promise.all(
      entries.map(async (entry) => {
        const { standing } = entry

        if (standing?.status !== 'outdated') return

        standing.upgrade = { status: 'running', progress: { stage: 'download', percent: 0 } }

        const outcome = await invoke('upgradeApp', entry.app.path)

        if (outcome.status === 'upgraded') {
          entry.app.version = outcome.version
          entry.app.build = outcome.build
          entry.standing = { status: 'upgraded' }
        } else {
          standing.upgrade = outcome.status === 'discarded' ? undefined : outcome
        }
      })
    )
  }

  protected async list(): Promise<void> {
    this.entries = (await invoke('listApps')).map((app) => ({ id: app.path, app }))
  }

  protected async check(): Promise<void> {
    await Promise.all(
      this.entries.map(async (entry) => {
        entry.standing = { status: 'checking' }
        entry.standing = await invoke('checkApp', entry.app.path)
      })
    )
  }

  protected pending(entry: Entry): boolean {
    return progressOf(entry) !== undefined
  }
}
