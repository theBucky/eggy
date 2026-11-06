import type { Status } from '$lib/components/status-dot.svelte'
import { tilde } from '$lib/paths'
import type { FetchOutcome, PullCommand, PullOutcome, Repo } from '$shared/api'

type Task =
  | { command: 'fetch' | PullCommand; status: 'running' }
  | ({ command: 'fetch' } & FetchOutcome)
  | ({ command: PullCommand } & PullOutcome)

export type Entry = {
  repo: Repo
  task?: Task
}

export function statusOf({ repo, task }: Entry): Status {
  if (task?.status === 'running' || task?.status === 'failed') return task.status

  if ((repo.sync?.behind ?? 0) > 0) return 'outdated'

  if (task === undefined) return 'unknown'

  return task.status === 'updated' ? 'updated' : 'current'
}

export function diverged({ repo }: Entry): boolean {
  return repo.sync !== undefined && repo.sync.ahead > 0 && repo.sync.behind > 0
}

const CONCURRENCY = 8

// Linked worktrees share refs, so their git commands run one after another to avoid lock errors.
async function each(entries: Entry[], run: (entry: Entry) => Promise<void>): Promise<void> {
  const queue = [...Map.groupBy(entries, (entry) => entry.repo.gitDir).values()]

  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let group = queue.shift(); group; group = queue.shift()) {
        for (const entry of group) await run(entry)
      }
    })
  )
}

export class Workspace {
  root = $state(localStorage.getItem('root') ?? `${window.api.home}/repo`)
  entries = $state<Entry[]>([])
  scanning = $state(false)
  activity = $derived(
    this.scanning
      ? 'scan'
      : this.entries.find(({ task }) => task?.status === 'running')?.task?.command
  )
  busy = $derived(this.activity !== undefined)
  // Counts a repo through its pull and after a failed one, so the tally holds steady.
  outdated = $derived(this.entries.filter(({ repo }) => (repo.sync?.behind ?? 0) > 0))

  relative(dir: string): string {
    return dir.startsWith(`${this.root}/`) ? dir.slice(this.root.length + 1) : tilde(dir)
  }

  async scan(): Promise<void> {
    this.scanning = true

    const repos = await window.api.scan(this.root)

    this.entries = repos.map((repo) => ({ repo }))
    this.scanning = false
  }

  async refresh(): Promise<void> {
    await this.scan()
    await each(this.entries, async (entry) => {
      entry.task = { command: 'fetch', status: 'running' }

      const { outcome, ...tracking } = await window.api.fetch(entry.repo.path)

      Object.assign(entry.repo, tracking)
      entry.task = { command: 'fetch', ...outcome }
    })
  }

  async chooseRoot(): Promise<void> {
    const root = await window.api.chooseRoot(this.root)

    if (root === undefined) return

    this.root = root
    localStorage.setItem('root', root)
    await this.scan()
  }

  async pull(entry: Entry, command: PullCommand): Promise<void> {
    entry.task = { command, status: 'running' }

    const { outcome, ...tracking } = await window.api.pull(entry.repo.path, command)

    Object.assign(entry.repo, tracking)
    entry.task = { command, ...outcome }
  }

  async pullAll(): Promise<void> {
    await each(this.outdated, (entry) => this.pull(entry, 'pull'))
  }
}
