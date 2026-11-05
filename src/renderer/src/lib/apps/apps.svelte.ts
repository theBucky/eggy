import type { Status } from '$lib/components/status-dot.svelte'
import type {
  App,
  CheckOutcome,
  Failure,
  InstallOutcome,
  Progress,
  Release
} from '../../../../shared/api'

export type Task =
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

export function statusOf({ task }: Entry): Status {
  if (task === undefined) return 'unknown'

  if (task.status === 'checked') return task.update === undefined ? 'current' : 'outdated'

  return task.status
}

export class Apps {
  entries = $state<Entry[]>([])
  scanning = $state(false)
  prompt = $state<Prompt>({ open: false, quitting: [] })
  activity = $derived(
    this.scanning
      ? 'scan'
      : this.entries.find(({ task }) => task?.status === 'running')?.task?.command
  )
  busy = $derived(this.activity !== undefined)
  outdated = $derived(this.entries.filter((entry) => statusOf(entry) === 'outdated'))

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
    const quitting: Entry[] = []

    await Promise.all(
      entries.map(async (entry) => {
        entry.task = {
          command: 'update',
          status: 'running',
          update: releaseOf(entry)!,
          progress: { stage: 'download', percent: 0 }
        }

        const outcome = await window.api.update(entry.app.path)

        if (outcome.status === 'waiting') quitting.push(entry)
        else this.settle(entry, outcome)
      })
    )

    if (quitting.length > 0) this.prompt = { open: true, quitting }
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
