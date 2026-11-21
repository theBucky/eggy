import { clauses } from '$lib/format'
import { dirOf, tilde } from '$lib/paths'
import { Pool } from '$lib/repos/pool'
import { Source } from '$lib/source.svelte'
import type { Status } from '$lib/status'
import type { FetchOutcome, PullCommand, PullOutcome, Repo, Sync } from '$shared/repos'

type Task =
  | { command: 'fetch'; status: 'running' }
  | { command: PullCommand; status: 'queued' | 'running' }
  | ({ command: 'fetch' } & FetchOutcome)
  | ({ command: PullCommand } & PullOutcome)

export type Entry = {
  id: string
  repo: Repo
  task?: Task
}

function unsettled(
  task: Task | undefined
): task is Extract<Task, { status: 'queued' | 'running' }> {
  return task?.status === 'queued' || task?.status === 'running'
}

export function statusOf(entry: Entry): Status {
  const { task } = entry

  if (unsettled(task)) return 'running'

  if (task?.status === 'failed') return 'failed'

  if (behind(entry)) return 'outdated'

  return task === undefined ? 'unknown' : 'current'
}

export function behind({ repo }: Entry): boolean {
  return (repo.sync?.behind ?? 0) > 0
}

export function diverged({ repo }: Entry): boolean {
  return repo.sync !== undefined && repo.sync.ahead > 0 && repo.sync.behind > 0
}

export function offsetsOf({ ahead, behind }: Sync): string {
  return clauses(ahead > 0 && `${ahead} ahead`, behind > 0 && `${behind} behind`)
}

export function pendingPull({ task }: Entry): PullCommand | undefined {
  return unsettled(task) && task.command !== 'fetch' ? task.command : undefined
}

export class Repos extends Source<Entry> {
  root = $state(localStorage.getItem('root') ?? `${window.api.home}/repo`)
  checked = $derived(this.entries.some(({ task }) => task !== undefined && !unsettled(task)))
  checkFailed = $derived(
    this.entries.some(({ task }) => task?.status === 'failed' && task.command === 'fetch')
  )
  outdated = $derived(this.entries.filter(behind))
  folders = $derived(
    Array.from(
      Map.groupBy(
        this.entries.toSorted((a, b) => a.repo.path.localeCompare(b.repo.path)),
        (entry) => dirOf(entry.repo.path)
      ),
      ([dir, entries]) => ({
        dir,
        label: dir.startsWith(`${this.root}/`) ? dir.slice(this.root.length + 1) : tilde(dir),
        entries
      })
    ).toSorted((a, b) => a.dir.localeCompare(b.dir))
  )
  // Linked worktrees share refs, so their git commands run one after another to avoid lock errors.
  #git = new Pool(8)

  async chooseRoot(): Promise<void> {
    const root = await window.api.invoke('chooseRoot', this.root)

    if (root === undefined) return

    this.root = root
    localStorage.setItem('root', root)
    await this.scan()
  }

  async upgrade(entries: Entry[], command: PullCommand = 'pull'): Promise<void> {
    for (const entry of entries) entry.task = { command, status: 'queued' }

    await Promise.all(
      entries.map((entry) =>
        this.#git.run(entry.repo.commonDir, async () => {
          entry.task = { command, status: 'running' }

          const { tracking, outcome } = await window.api.invoke(
            'pullRepo',
            entry.repo.path,
            command
          )

          Object.assign(entry.repo, tracking)
          entry.task = { command, ...outcome }
        })
      )
    )
  }

  protected async list(): Promise<void> {
    const repos = await window.api.invoke('scanRepos', this.root)

    this.entries = repos.map((repo) => ({ id: repo.path, repo }))
  }

  protected async check(): Promise<void> {
    await Promise.all(
      this.entries.map((entry) =>
        this.#git.run(entry.repo.commonDir, async () => {
          entry.task = { command: 'fetch', status: 'running' }

          const { tracking, outcome } = await window.api.invoke('fetchRepo', entry.repo.path)

          Object.assign(entry.repo, tracking)
          entry.task = { command: 'fetch', ...outcome }
        })
      )
    )
  }

  protected pending(entry: Entry): boolean {
    return pendingPull(entry) !== undefined
  }
}
