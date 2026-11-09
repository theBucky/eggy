import type { Status } from '$lib/components/status-dot.svelte'
import type { Failure, Package, PackageList, PackageUpgrade } from '$shared/api'

type Check = { status: 'running' | 'checked' } | Failure

type Task = { output: string } & ({ status: 'running' } | PackageUpgrade)

export type Entry = {
  package: Package
  task?: Task
}

// A formula and a cask can share a name.
export function idOf({ kind, fullName }: Package): string {
  return `${kind}:${fullName}`
}

export class Packages {
  installed = $state(false)
  entries = $state<Entry[]>([])
  scanning = $state(false)
  #refreshing = $state(false)
  check = $state<Check>()
  checking = $derived(this.scanning || this.#refreshing)
  upgrading = $derived(this.entries.some(({ task }) => task?.status === 'running'))
  busy = $derived(this.checking || this.upgrading)
  outdated = $derived(this.entries.filter(({ package: pkg }) => pkg.state === 'outdated'))

  constructor() {
    window.api.onOutput((kind, fullName, text) => {
      const task = this.entries.find(
        ({ package: pkg }) => pkg.kind === kind && pkg.fullName === fullName
      )?.task

      if (task?.status === 'running') task.output += text
    })
  }

  statusOf({ package: pkg, task }: Entry): Status {
    if (task?.status === 'running' || task?.status === 'failed') return task.status

    if (this.check?.status === 'running') return 'running'

    if (pkg.state === 'outdated') return 'outdated'

    return task === undefined && this.check?.status !== 'checked' ? 'unknown' : 'current'
  }

  async scan(): Promise<void> {
    this.scanning = true

    const list = await window.api.listPackages()

    this.check = list.status === 'failed' ? list : undefined
    this.apply(list)
    this.scanning = false
  }

  async refresh(): Promise<void> {
    this.#refreshing = true
    await this.scan()

    if (this.installed) {
      this.check = { status: 'running' }

      const list = await window.api.checkPackages()

      this.check = list.status === 'failed' ? list : { status: 'checked' }
      this.apply(list)
    }

    this.#refreshing = false
  }

  // brew locks the kegs it installs, so upgrades that share dependencies would collide.
  async upgrade(entries: Entry[]): Promise<void> {
    for (const entry of entries) {
      // An earlier upgrade in the batch may have upgraded this one as a dependency.
      if (entry.package.state !== 'outdated') continue

      entry.task = { status: 'running', output: '' }

      const outcome = await window.api.upgradePackage(entry.package.kind, entry.package.fullName)
      const list = await window.api.listPackages()

      entry.task = { output: entry.task.output, ...outcome }

      if (list.status === 'listed') this.merge(list.packages)
    }
  }

  private apply(list: PackageList): void {
    this.installed = list.status !== 'missing'

    if (list.status === 'listed') this.entries = list.packages.map((pkg) => ({ package: pkg }))
    else if (list.status === 'missing') this.entries = []
  }

  // Keeps each surviving entry, so its task and any upgrade still waiting on it carry over.
  private merge(packages: Package[]): void {
    const entries = new Map(this.entries.map((entry) => [idOf(entry.package), entry]))

    this.entries = packages.map((pkg) => {
      const entry = entries.get(idOf(pkg))

      if (entry === undefined) return { package: pkg }

      entry.package = pkg

      return entry
    })
  }
}
