import type { FetchOutcome, PullOutcome, Repo } from '../../../../shared/api'

export type Task =
  | { command: 'fetch' | 'pull'; status: 'running' }
  | ({ command: 'fetch' } & FetchOutcome)
  | ({ command: 'pull' } & PullOutcome)

export type Entry = {
  repo: Repo
  task?: Task
}

export type Status = 'unknown' | 'running' | 'failed' | 'outdated' | 'updated' | 'current'

export function statusOf({ repo, task }: Entry): Status {
  if (task?.status === 'running' || task?.status === 'failed') return task.status

  // Local upstream refs already show how far behind the last fetch left the branch.
  if ((repo.sync?.behind ?? 0) > 0) return 'outdated'

  if (task === undefined) return 'unknown'

  return task.status === 'updated' ? 'updated' : 'current'
}

// Bounded so fetching or pulling everything doesn't open dozens of connections to the same host at once.
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
  // Callers start git work only while idle, so two commands never race on one repo's locks and
  // any running task tells which batch is underway.
  activity = $derived(
    this.scanning
      ? 'scan'
      : this.entries.find(({ task }) => task?.status === 'running')?.task?.command
  )
  busy = $derived(this.activity !== undefined)
  outdated = $derived(this.entries.filter((entry) => statusOf(entry) === 'outdated'))

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

      const { sync, outcome } = await window.api.fetch(entry.repo.path)

      entry.repo.sync = sync
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

  async pull(entry: Entry): Promise<void> {
    entry.task = { command: 'pull', status: 'running' }

    const { sync, history, outcome } = await window.api.pull(entry.repo.path)

    entry.repo.sync = sync
    entry.repo.history = history
    entry.task = { command: 'pull', ...outcome }
  }

  async pullAll(): Promise<void> {
    await each(this.outdated, (entry) => this.pull(entry))
  }
}
