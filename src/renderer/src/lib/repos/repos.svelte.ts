import type { Status } from '$lib/status'
import { tilde } from '$lib/paths'
import { Serial } from '$lib/serial'
import type { Phase, Source } from '$lib/sources.svelte'
import type { FetchOutcome, PullCommand, PullOutcome, Repo, Sync } from '$shared/api'

type Task =
  | { command: 'fetch'; status: 'running' }
  | { command: PullCommand; status: 'queued' | 'running' }
  | ({ command: 'fetch' } & FetchOutcome)
  | ({ command: PullCommand } & PullOutcome)

export type Entry = {
  repo: Repo
  task?: Task
}

function pending(task: Task | undefined): task is Extract<Task, { status: 'queued' | 'running' }> {
  return task?.status === 'queued' || task?.status === 'running'
}

export function statusOf(entry: Entry): Status {
  const { task } = entry

  if (pending(task)) return 'running'

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
  return [ahead > 0 && `${ahead} ahead`, behind > 0 && `${behind} behind`]
    .filter((offset) => offset !== false)
    .join(', ')
}

export function pendingPull({ task }: Entry): PullCommand | undefined {
  return pending(task) && task.command !== 'fetch' ? task.command : undefined
}

const CONCURRENCY = 8

// Worktrees of one repo wait on each other anyway, so each worker takes a whole repo's worth.
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

export class Repos implements Source {
  root = $state(localStorage.getItem('root') ?? `${window.api.home}/repo`)
  entries = $state<Entry[]>([])
  #phase = $state<Phase>('idle')
  // Linked worktrees share refs, so their git commands run one after another to avoid lock errors.
  #serials = new Map<string, Serial>()
  scanning = $derived(this.#phase === 'scanning')
  checking = $derived(this.#phase === 'scanning' || this.#phase === 'checking')
  bulk = $derived(this.#phase === 'bulk')
  busy = $derived(
    this.#phase !== 'idle' || this.entries.some((entry) => pendingPull(entry) !== undefined)
  )
  checked = $derived(this.entries.some(({ task }) => task !== undefined && !pending(task)))
  checkFailed = $derived(
    this.entries.some(({ task }) => task?.status === 'failed' && task.command === 'fetch')
  )
  // Counts a repo through its pull and after a failed one, so the tally holds steady.
  outdated = $derived(this.entries.filter(behind))

  relative(dir: string): string {
    return dir.startsWith(`${this.root}/`) ? dir.slice(this.root.length + 1) : tilde(dir)
  }

  async scan(): Promise<void> {
    this.#phase = 'scanning'
    await this.#list()
    this.#phase = 'idle'
  }

  async refresh(): Promise<void> {
    this.#phase = 'scanning'
    await this.#list()
    this.#phase = 'checking'
    await each(this.entries, async (entry) => {
      entry.task = { command: 'fetch', status: 'running' }

      const { outcome, ...tracking } = await window.api.fetchRepo(entry.repo.path)

      Object.assign(entry.repo, tracking)
      entry.task = { command: 'fetch', ...outcome }
    })
    this.#phase = 'idle'
  }

  async chooseRoot(): Promise<void> {
    const root = await window.api.chooseRoot(this.root)

    if (root === undefined) return

    this.root = root
    localStorage.setItem('root', root)
    await this.scan()
  }

  async pull(entries: Entry[], command: PullCommand): Promise<void> {
    for (const entry of entries) entry.task = { command, status: 'queued' }

    await each(entries, (entry) =>
      this.#serialOf(entry).run(async () => {
        entry.task = { command, status: 'running' }

        const { outcome, ...tracking } = await window.api.pullRepo(entry.repo.path, command)

        Object.assign(entry.repo, tracking)
        entry.task = { command, ...outcome }
      })
    )
  }

  async upgradeOutdated(): Promise<void> {
    this.#phase = 'bulk'
    await this.pull(this.outdated, 'pull')
    this.#phase = 'idle'
  }

  canPull(entry: Entry): boolean {
    return this.#phase === 'idle' && pendingPull(entry) === undefined
  }

  async #list(): Promise<void> {
    this.entries = (await window.api.scanRepos(this.root)).map((repo) => ({ repo }))
  }

  #serialOf({ repo }: Entry): Serial {
    const serial = this.#serials.get(repo.gitDir) ?? new Serial()

    this.#serials.set(repo.gitDir, serial)

    return serial
  }
}
