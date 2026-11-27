import type { App, CheckOutcome, InstallOutcome, Progress, Release } from '$shared/apps'
import type { Failure } from '$shared/failure'
import { Source } from '$source/source.svelte'
import type { Status } from '$source/status'
import { QuitPrompt } from './quit-prompt.svelte'

type Check = { status: 'running' } | CheckOutcome

type Upgrade = { status: 'running'; progress: Progress } | InstallOutcome

export type Entry = {
  id: string
  app: App
  check?: Check
  upgrade?: Upgrade
}

export function releaseOf({ check }: Entry): Release | undefined {
  return check?.status === 'checked' ? check.release : undefined
}

export function progressOf({ upgrade }: Entry): Progress | undefined {
  return upgrade?.status === 'running' ? upgrade.progress : undefined
}

export function failureOf({ check, upgrade }: Entry): Failure | undefined {
  if (upgrade?.status === 'failed') return upgrade

  return check?.status === 'failed' ? check : undefined
}

export function labelOf({ version, build }: App | Release): string {
  return version === build ? version : `${version} (${build})`
}

export class Apps extends Source<Entry> {
  readonly prompt = new QuitPrompt()
  checked = $derived(
    this.entries.some(({ check }) => check !== undefined && check.status !== 'running')
  )
  checkFailed = $derived(this.entries.some(({ check }) => check?.status === 'failed'))
  outdated = $derived(this.entries.filter(releaseOf))

  constructor() {
    super()
    window.api.on('appProgress', (path, progress) => {
      const entry = this.find(path)

      if (entry?.upgrade?.status !== 'running') return

      entry.upgrade.progress = progress

      if (progress.stage === 'waiting') {
        this.prompt.ask(entry.app).then((quit) => window.api.invoke('answerAppQuit', path, quit))
      }
    })
  }

  statusOf({ check, upgrade }: Entry): Status {
    if (check?.status === 'running' || upgrade?.status === 'running') return 'running'

    if (check?.status === 'failed' || upgrade?.status === 'failed') return 'failed'

    if (check === undefined) return 'unknown'

    return check.release === undefined ? 'current' : 'outdated'
  }

  async upgrade(entries: Entry[]): Promise<void> {
    await Promise.all(
      entries.map(async (entry) => {
        entry.upgrade = { status: 'running', progress: { stage: 'download', percent: 0 } }

        const outcome = await window.api.invoke('upgradeApp', entry.app.path)

        if (outcome.status === 'upgraded') {
          entry.app.version = outcome.version
          entry.app.build = outcome.build
          entry.check = { status: 'checked', release: undefined }
        }

        entry.upgrade = outcome.status === 'discarded' ? undefined : outcome
      })
    )
  }

  protected async list(): Promise<void> {
    this.entries = (await window.api.invoke('listApps')).map((app) => ({ id: app.path, app }))
  }

  protected async check(): Promise<void> {
    await Promise.all(
      this.entries.map(async (entry) => {
        entry.check = { status: 'running' }
        entry.check = await window.api.invoke('checkApp', entry.app.path)
      })
    )
  }

  protected pending({ upgrade }: Entry): boolean {
    return upgrade?.status === 'running'
  }
}
