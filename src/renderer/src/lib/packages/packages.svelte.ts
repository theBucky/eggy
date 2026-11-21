import { Source } from '$lib/source.svelte'
import type { Status } from '$lib/status'
import type { Failure } from '$shared/failure'
import type { Package, PackageCheck, PackageList, PackageUpgrade } from '$shared/packages'

type Listing = { status: 'missing' | 'listed' | 'checked' } | Failure

type Task =
  | { status: 'queued' }
  | { status: 'running'; output: string }
  | ({ output: string } & PackageUpgrade)

export type Entry = {
  id: string
  package: Package
  task?: Task
}

// A formula and a cask can share a name.
function idOf({ kind, fullName }: Pick<Package, 'kind' | 'fullName'>): string {
  return `${kind}:${fullName}`
}

function entryOf(pkg: Package): Entry {
  return { id: idOf(pkg), package: pkg }
}

export class Packages extends Source<Entry> {
  listing = $state<Listing>()
  installed = $derived(this.listing !== undefined && this.listing.status !== 'missing')
  checked = $derived(this.listing?.status === 'checked' || this.listing?.status === 'failed')
  checkFailed = $derived(this.listing?.status === 'failed')
  outdated = $derived(this.entries.filter(({ package: pkg }) => pkg.state === 'outdated'))
  requested = $derived(this.entries.filter(({ package: pkg }) => pkg.requested))
  // brew locks the kegs it installs, so upgrades that share dependencies would collide.
  #queue = Promise.resolve()

  constructor() {
    super()
    window.api.on('packageOutput', (kind, fullName, text) => {
      const task = this.find(idOf({ kind, fullName }))?.task

      if (task?.status === 'running') task.output += text
    })
  }

  statusOf(entry: Entry): Status {
    const { package: pkg, task } = entry

    if (this.pending(entry)) return 'running'

    if (task?.status === 'failed') return 'failed'

    if (this.phase === 'checking') return 'running'

    if (pkg.state === 'outdated') return 'outdated'

    return task === undefined && this.listing?.status !== 'checked' ? 'unknown' : 'current'
  }

  async upgrade(entries: Entry[]): Promise<void> {
    for (const entry of entries) entry.task = { status: 'queued' }

    this.#queue = this.#queue.then(async () => {
      for (const entry of entries) {
        // An earlier upgrade may have upgraded this one as a dependency.
        if (entry.package.state !== 'outdated') {
          entry.task = undefined
          continue
        }

        entry.task = { status: 'running', output: '' }

        const { kind, fullName } = entry.package
        const outcome = await window.api.invoke('upgradePackage', kind, fullName)
        const reply = await window.api.invoke('listPackages')

        entry.task = { output: entry.task.output, ...outcome }

        if (reply.status === 'listed') this.#merge(reply.packages)
      }
    })

    await this.#queue
  }

  protected async list(): Promise<void> {
    this.#apply(await window.api.invoke('listPackages'))
  }

  protected async check(): Promise<void> {
    if (this.installed) this.#apply(await window.api.invoke('checkPackages'))
  }

  protected pending({ task }: Entry): boolean {
    return task?.status === 'queued' || task?.status === 'running'
  }

  #apply(reply: PackageList | PackageCheck): void {
    if (reply.status === 'missing') this.entries = []
    else if (reply.status !== 'failed') this.entries = reply.packages.map(entryOf)

    this.listing = reply.status === 'failed' ? reply : { status: reply.status }
  }

  #merge(packages: Package[]): void {
    const entries = new Map(this.entries.map((entry) => [entry.id, entry]))

    this.entries = packages.map((pkg) => {
      const entry = entries.get(idOf(pkg))

      if (entry === undefined) return entryOf(pkg)

      entry.package = pkg

      return entry
    })
  }
}
