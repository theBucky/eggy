import { QuitPrompt } from '$lib/apps/quit-prompt.svelte'
import { Source } from '$lib/source.svelte'
import type { Status } from '$lib/status'
import type { App, CheckOutcome, InstallOutcome, Progress, Release } from '$shared/apps'
import type { Failure } from '$shared/failure'

type Task =
  | { command: 'check'; status: 'running' }
  | ({ command: 'check' } & CheckOutcome)
  | { command: 'upgrade'; status: 'running'; release: Release; progress: Progress }
  | ({ command: 'upgrade'; release: Release } & Failure)
  | { command: 'upgrade'; status: 'upgraded' }

export type Entry = {
  id: string
  app: App
  task?: Task
}

function upgrading(
  task: Task | undefined
): task is Extract<Task, { command: 'upgrade'; status: 'running' }> {
  return task?.command === 'upgrade' && task.status === 'running'
}

export function releaseOf({ task }: Entry): Release | undefined {
  return task !== undefined && 'release' in task ? task.release : undefined
}

export function progressOf({ task }: Entry): Progress | undefined {
  return upgrading(task) ? task.progress : undefined
}

export function statusOf({ task }: Entry): Status {
  if (task === undefined) return 'unknown'

  if (task.status === 'checked') return task.release === undefined ? 'current' : 'outdated'

  return task.status === 'upgraded' ? 'current' : task.status
}

export function labelOf({ version, build }: App | Release): string {
  return version === build ? version : `${version} (${build})`
}

export class Apps extends Source<Entry> {
  readonly prompt = new QuitPrompt()
  checked = $derived(
    this.entries.some(({ task }) => task !== undefined && task.status !== 'running')
  )
  checkFailed = $derived(
    this.entries.some(({ task }) => task?.status === 'failed' && task.command === 'check')
  )
  outdated = $derived(this.entries.filter(releaseOf))

  constructor() {
    super()
    window.api.on('appProgress', (path, progress) => {
      const task = this.find(path)?.task

      if (upgrading(task)) task.progress = progress
    })
  }

  async upgrade(entries: Entry[]): Promise<void> {
    await Promise.all(
      entries.map(async (entry) => {
        const release = releaseOf(entry)

        if (release === undefined) return

        entry.task = {
          command: 'upgrade',
          status: 'running',
          release,
          progress: { stage: 'download', percent: 0 }
        }

        const outcome = await window.api.invoke('upgradeApp', entry.app.path)

        if (outcome.status === 'waiting') void this.#settleWaiting(entry, release)
        else this.#settle(entry, release, outcome)
      })
    )
  }

  protected async list(): Promise<void> {
    this.entries = (await window.api.invoke('listApps')).map((app) => ({ id: app.path, app }))
  }

  protected async check(): Promise<void> {
    await Promise.all(
      this.entries.map(async (entry) => {
        entry.task = { command: 'check', status: 'running' }

        entry.task = { command: 'check', ...(await window.api.invoke('checkApp', entry.app.path)) }
      })
    )
  }

  protected pending({ task }: Entry): boolean {
    return upgrading(task)
  }

  async #settleWaiting(entry: Entry, release: Release): Promise<void> {
    if (await this.prompt.ask(entry.app)) {
      this.#settle(entry, release, await window.api.invoke('forceAppUpgrade', entry.app.path))
    } else {
      await window.api.invoke('discardAppUpgrade', entry.app.path)
      entry.task = { command: 'check', status: 'checked', release }
    }
  }

  #settle(entry: Entry, release: Release, outcome: InstallOutcome): void {
    if (outcome.status === 'upgraded') {
      entry.app.version = outcome.version
      entry.app.build = outcome.build
      entry.task = { command: 'upgrade', status: 'upgraded' }
    } else {
      entry.task = { command: 'upgrade', release, ...outcome }
    }
  }
}
