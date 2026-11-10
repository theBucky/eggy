import type { Status } from '$lib/status'
import type { Source } from '$lib/sources.svelte'
import type { App, CheckOutcome, Failure, InstallOutcome, Progress, Release } from '$shared/api'

type Task =
  | { command: 'check'; status: 'running' }
  | ({ command: 'check' } & CheckOutcome)
  | { command: 'upgrade'; status: 'running'; release: Release; progress: Progress }
  | ({ command: 'upgrade'; release: Release } & Failure)
  | { command: 'upgrade'; status: 'upgraded' }

export type Entry = {
  app: App
  task?: Task
}

// Kept after closing, so the dialog fades out with the apps it named.
type Prompt = {
  open: boolean
  quitting: { entry: Entry; release: Release }[]
}

export function releaseOf({ task }: Entry): Release | undefined {
  return task !== undefined && 'release' in task ? task.release : undefined
}

export function labelOf({ version, build }: App | Release): string {
  return version === build ? version : `${version} (${build})`
}

export function statusOf({ task }: Entry): Status {
  if (task === undefined) return 'unknown'

  if (task.status === 'checked') return task.release === undefined ? 'current' : 'outdated'

  return task.status === 'upgraded' ? 'current' : task.status
}

export class Apps implements Source {
  entries = $state<Entry[]>([])
  scanning = $state(false)
  #refreshing = $state(false)
  prompt = $state<Prompt>({ open: false, quitting: [] })
  checking = $derived(this.scanning || this.#refreshing)
  upgrading = $derived(
    this.entries.some(({ task }) => task?.status === 'running' && task.command === 'upgrade')
  )
  busy = $derived(this.checking || this.upgrading)
  checked = $derived(
    this.entries.some(({ task }) => task !== undefined && task.status !== 'running')
  )
  checkFailed = $derived(
    this.entries.some(({ task }) => task?.status === 'failed' && task.command === 'check')
  )
  // Counts an app through its download and after a failed install, so the tally holds steady.
  outdated = $derived(this.entries.filter(releaseOf))

  constructor() {
    window.api.onAppProgress((path, progress) => {
      const task = this.entries.find((entry) => entry.app.path === path)?.task

      if (task?.command === 'upgrade' && task.status === 'running') task.progress = progress
    })
  }

  async scan(): Promise<void> {
    this.scanning = true
    this.entries = (await window.api.listApps()).map((app) => ({ app }))
    this.scanning = false
  }

  async refresh(): Promise<void> {
    this.#refreshing = true
    await this.scan()
    await Promise.all(
      this.entries.map(async (entry) => {
        entry.task = { command: 'check', status: 'running' }

        entry.task = { command: 'check', ...(await window.api.checkApp(entry.app.path)) }
      })
    )
    this.#refreshing = false
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

        const outcome = await window.api.upgradeApp(entry.app.path)

        if (outcome.status !== 'waiting') this.#settle(entry, release, outcome)
        else if (this.prompt.open) this.prompt.quitting.push({ entry, release })
        else this.prompt = { open: true, quitting: [{ entry, release }] }
      })
    )
  }

  upgradeOutdated(): Promise<void> {
    return this.upgrade(this.outdated)
  }

  async confirm(): Promise<void> {
    this.prompt.open = false

    await Promise.all(
      this.prompt.quitting.map(async ({ entry, release }) => {
        this.#settle(entry, release, await window.api.forceAppUpgrade(entry.app.path))
      })
    )
  }

  async cancel(): Promise<void> {
    this.prompt.open = false

    await Promise.all(
      this.prompt.quitting.map(async ({ entry, release }) => {
        await window.api.discardAppUpgrade(entry.app.path)
        entry.task = { command: 'check', status: 'checked', release }
      })
    )
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
