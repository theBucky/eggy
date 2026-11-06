import type { Status } from '$lib/components/status-dot.svelte'
import type { App, CheckOutcome, Failure, InstallOutcome, Progress, Release } from '$shared/api'

type Task =
  | { command: 'check'; status: 'running' }
  | ({ command: 'check' } & CheckOutcome)
  | { command: 'update'; status: 'running'; update: Release; progress: Progress }
  | ({ command: 'update'; update: Release } & Failure)
  | { command: 'update'; status: 'updated' }

export type Entry = {
  app: App
  task?: Task
}

// Kept after closing, so the dialog fades out with the apps it named.
type Prompt = {
  open: boolean
  quitting: Entry[]
}

export function releaseOf({ task }: Entry): Release | undefined {
  return task !== undefined && 'update' in task ? task.update : undefined
}

export function labelOf({ version, build }: App | Release): string {
  return version === build ? version : `${version} (${build})`
}

const megabyte = new Intl.NumberFormat('en', {
  style: 'unit',
  unit: 'megabyte',
  maximumFractionDigits: 1
})

export function megabytes(bytes: number): string {
  return megabyte.format(bytes / 1e6)
}

export function statusOf({ task }: Entry): Status {
  if (task === undefined) return 'unknown'

  if (task.status === 'checked') return task.update === undefined ? 'current' : 'outdated'

  return task.status
}

export class Apps {
  entries = $state<Entry[]>([])
  scanning = $state(false)
  prompt = $state<Prompt>({ open: false, quitting: [] })
  checking = $derived(
    this.scanning ||
      this.entries.some(({ task }) => task?.status === 'running' && task.command === 'check')
  )
  updating = $derived(
    this.entries.some(({ task }) => task?.status === 'running' && task.command === 'update')
  )
  busy = $derived(this.checking || this.updating)
  checkFailed = $derived(
    this.entries.some(({ task }) => task?.status === 'failed' && task.command === 'check')
  )
  // Counts an app through its download and after a failed install, so the tally holds steady.
  outdated = $derived(this.entries.filter(releaseOf))

  constructor() {
    window.api.onProgress((path, progress) => {
      const task = this.entries.find((entry) => entry.app.path === path)?.task

      if (task?.command === 'update' && task.status === 'running') task.progress = progress
    })
  }

  async scan(): Promise<void> {
    this.scanning = true
    this.entries = (await window.api.listApps()).map((app) => ({ app }))
    this.scanning = false
  }

  async refresh(): Promise<void> {
    await this.scan()
    await Promise.all(
      this.entries.map(async (entry) => {
        entry.task = { command: 'check', status: 'running' }

        entry.task = { command: 'check', ...(await window.api.check(entry.app.path)) }
      })
    )
  }

  async update(entries: Entry[]): Promise<void> {
    await Promise.all(
      entries.map(async (entry) => {
        entry.task = {
          command: 'update',
          status: 'running',
          update: releaseOf(entry)!,
          progress: { stage: 'download', percent: 0 }
        }

        const outcome = await window.api.update(entry.app.path)

        if (outcome.status !== 'waiting') this.settle(entry, outcome)
        else if (this.prompt.open) this.prompt.quitting.push(entry)
        else this.prompt = { open: true, quitting: [entry] }
      })
    )
  }

  async confirm(): Promise<void> {
    this.prompt.open = false

    await Promise.all(
      this.prompt.quitting.map(async (entry) => {
        this.settle(entry, await window.api.forceUpdate(entry.app.path))
      })
    )
  }

  async cancel(): Promise<void> {
    this.prompt.open = false

    await Promise.all(
      this.prompt.quitting.map(async (entry) => {
        await window.api.discardUpdate(entry.app.path)
        entry.task = { command: 'check', status: 'checked', update: releaseOf(entry) }
      })
    )
  }

  private settle(entry: Entry, outcome: InstallOutcome): void {
    if (outcome.status === 'updated') {
      entry.app.version = outcome.version
      entry.app.build = outcome.build
      entry.task = { command: 'update', status: 'updated' }
    } else {
      entry.task = { command: 'update', update: releaseOf(entry)!, ...outcome }
    }
  }
}
