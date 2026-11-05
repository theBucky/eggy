import type { Status } from '$lib/components/status-dot.svelte'
import type { App, Failure, InstallOutcome, Progress, Release } from '../../../../shared/api'

export type Task =
  | { command: 'check'; status: 'running' | 'checked' }
  | { command: 'update'; status: 'running'; progress: Progress }
  | { command: 'update'; status: 'updated' }
  | ({ command: 'check' | 'update' } & Failure)

export type Entry = {
  app: App
  update: Release | undefined
  task?: Task
}

// Kept after closing, so the dialog fades out with the apps it named.
type Prompt = {
  open: boolean
  quitting: Entry[]
}

export function statusOf({ update, task }: Entry): Status {
  if (task?.status === 'running' || task?.status === 'failed') return task.status

  if (update !== undefined) return 'outdated'

  if (task === undefined) return 'unknown'

  return task.status === 'updated' ? 'updated' : 'current'
}

export class Apps {
  entries = $state<Entry[]>([])
  scanning = $state(false)
  prompt = $state<Prompt>({ open: false, quitting: [] })
  // Callers start work only while idle, so any running task tells which batch is underway.
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

  async refresh(): Promise<void> {
    this.scanning = true
    this.entries = (await window.api.listApps()).map((app) => ({ app, update: undefined }))
    this.scanning = false

    await Promise.all(
      this.entries.map(async (entry) => {
        entry.task = { command: 'check', status: 'running' }

        const outcome = await window.api.check(entry.app.path)

        if (outcome.status === 'checked') {
          entry.update = outcome.update
          entry.task = { command: 'check', status: 'checked' }
        } else {
          entry.task = { command: 'check', ...outcome }
        }
      })
    )
  }

  // Apps that turn out to be running wait on one prompt once every download in the batch is done.
  async update(entries: Entry[]): Promise<void> {
    const quitting: Entry[] = []

    await Promise.all(
      entries.map(async (entry) => {
        entry.task = {
          command: 'update',
          status: 'running',
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
        entry.task = undefined
      })
    )
  }

  private settle(entry: Entry, outcome: InstallOutcome): void {
    if (outcome.status === 'updated') {
      entry.app.version = outcome.version
      entry.app.build = outcome.build
      entry.update = undefined
      entry.task = { command: 'update', status: 'updated' }
    } else {
      entry.task = { command: 'update', ...outcome }
    }
  }
}
