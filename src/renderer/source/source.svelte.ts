import type { Status } from './status'

type Phase = 'idle' | 'scanning' | 'checking'

export type Bulk = 'none' | 'running' | 'ready'

export abstract class Source<Entry extends { id: string } = { id: string }> {
  abstract readonly checked: boolean
  abstract readonly checkFailed: boolean
  abstract readonly outdated: Entry[]
  entries = $state<Entry[]>([])
  #phase = $state<Phase>('idle')
  #upgrading = $derived(this.entries.some((entry) => this.pending(entry)))
  scanning = $derived(this.#phase === 'scanning')
  checking = $derived(this.#phase === 'scanning' || this.#phase === 'checking')
  busy = $derived(this.#phase !== 'idle' || this.#upgrading)
  upgradable = $derived.by(() => this.outdated.filter((entry) => this.canUpgrade(entry)))
  bulk = $derived<Bulk>(this.upgradable.length > 0 ? 'ready' : this.#upgrading ? 'running' : 'none')

  protected get phase(): Phase {
    return this.#phase
  }

  find(id: string): Entry | undefined {
    return this.entries.find((entry) => entry.id === id)
  }

  canUpgrade(entry: Entry): boolean {
    return this.#phase === 'idle' && !this.pending(entry)
  }

  async scan(): Promise<void> {
    this.#phase = 'scanning'
    await this.list()
    this.#phase = 'idle'
  }

  async refresh(): Promise<void> {
    this.#phase = 'scanning'
    await this.list()
    this.#phase = 'checking'
    await this.check()
    this.#phase = 'idle'
  }

  async upgradeOutdated(): Promise<void> {
    await this.upgrade(this.upgradable)
  }

  abstract statusOf(entry: Entry): Status

  abstract upgrade(entries: Entry[]): Promise<void>

  protected abstract list(): Promise<void>

  protected abstract check(): Promise<void>

  protected abstract pending(entry: Entry): boolean
}
