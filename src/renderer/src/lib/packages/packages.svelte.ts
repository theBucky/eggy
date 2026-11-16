import { Serial } from '$lib/serial'
import type { Status } from '$lib/status'
import type { Phase, Source } from '$lib/sources.svelte'
import type { Failure, Package, PackageList, PackageUpgrade } from '$shared/api'

type Check = { status: 'checked' } | Failure

type Task = { output: string } & ({ status: 'queued' | 'running' } | PackageUpgrade)

export type Entry = {
  package: Package
  task?: Task
}

// A formula and a cask can share a name.
export function idOf({ kind, fullName }: Package): string {
  return `${kind}:${fullName}`
}

function pending({ task }: Entry): boolean {
  return task?.status === 'queued' || task?.status === 'running'
}

export class Packages implements Source {
  installed = $state(false)
  entries = $state<Entry[]>([])
  #phase = $state<Phase>('idle')
  check = $state<Check>()
  scanning = $derived(this.#phase === 'scanning')
  checking = $derived(this.#phase === 'scanning' || this.#phase === 'checking')
  bulk = $derived(this.#phase === 'bulk')
  busy = $derived(this.#phase !== 'idle' || this.entries.some(pending))
  checked = $derived(this.check !== undefined)
  checkFailed = $derived(this.check?.status === 'failed')
  outdated = $derived(this.entries.filter(({ package: pkg }) => pkg.state === 'outdated'))

  constructor() {
    window.api.onPackageOutput((kind, fullName, text) => {
      const task = this.entries.find(
        ({ package: pkg }) => pkg.kind === kind && pkg.fullName === fullName
      )?.task

      if (task?.status === 'running') task.output += text
    })
  }

  statusOf(entry: Entry): Status {
    const { package: pkg, task } = entry

    if (pending(entry)) return 'running'

    if (task?.status === 'failed') return 'failed'

    if (this.#phase === 'checking') return 'running'

    if (pkg.state === 'outdated') return 'outdated'

    return task === undefined && this.check?.status !== 'checked' ? 'unknown' : 'current'
  }

  async scan(): Promise<void> {
    this.#phase = 'scanning'
    await this.#list()
    this.#phase = 'idle'
  }

  async refresh(): Promise<void> {
    this.#phase = 'scanning'
    await this.#list()

    if (this.installed) {
      this.#phase = 'checking'

      const list = await window.api.checkPackages()

      this.check = list.status === 'failed' ? list : { status: 'checked' }
      this.#apply(list)
    }

    this.#phase = 'idle'
  }

  // brew locks the kegs it installs, so upgrades that share dependencies would collide.
  #serial = new Serial()

  upgrade(entries: Entry[]): Promise<void> {
    for (const entry of entries) entry.task = { status: 'queued', output: '' }

    return this.#serial.run(() => this.#upgrade(entries))
  }

  async upgradeOutdated(): Promise<void> {
    this.#phase = 'bulk'
    await this.upgrade(this.outdated)
    this.#phase = 'idle'
  }

  canUpgrade(entry: Entry): boolean {
    return this.#phase === 'idle' && !pending(entry)
  }

  async #list(): Promise<void> {
    const list = await window.api.listPackages()

    this.check = list.status === 'failed' ? list : undefined
    this.#apply(list)
  }

  async #upgrade(entries: Entry[]): Promise<void> {
    for (const entry of entries) {
      // An earlier upgrade may have upgraded this one as a dependency.
      if (entry.package.state !== 'outdated') {
        entry.task = undefined
        continue
      }

      entry.task = { status: 'running', output: '' }

      const outcome = await window.api.upgradePackage(entry.package.kind, entry.package.fullName)
      const list = await window.api.listPackages()

      entry.task = { output: entry.task.output, ...outcome }

      if (list.status === 'listed') this.#merge(list.packages)
    }
  }

  #apply(list: PackageList): void {
    this.installed = list.status !== 'missing'

    if (list.status === 'listed') this.entries = list.packages.map((pkg) => ({ package: pkg }))
    else if (list.status === 'missing') this.entries = []
  }

  // Keeps each surviving entry, so its task and any upgrade still waiting on it carry over.
  #merge(packages: Package[]): void {
    const entries = new Map(this.entries.map((entry) => [idOf(entry.package), entry]))

    this.entries = packages.map((pkg) => {
      const entry = entries.get(idOf(pkg))

      if (entry === undefined) return { package: pkg }

      entry.package = pkg

      return entry
    })
  }
}
