import type { Status } from '$lib/status'

type Phase = 'idle' | 'scanning' | 'checking' | 'bulk'

export abstract class Source<Entry extends { id: string } = { id: string }> {
  abstract readonly checked: boolean
  abstract readonly checkFailed: boolean
  abstract readonly outdated: Entry[]
  entries = $state<Entry[]>([])
  #phase = $state<Phase>('idle')
  scanning = $derived(this.#phase === 'scanning')
  checking = $derived(this.#phase === 'scanning' || this.#phase === 'checking')
  bulk = $derived(this.#phase === 'bulk')
  busy = $derived(this.#phase !== 'idle' || this.entries.some((entry) => this.pending(entry)))

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
    this.#phase = 'bulk'
    await this.upgrade(this.outdated)
    this.#phase = 'idle'
  }

  abstract statusOf(entry: Entry): Status

  abstract upgrade(entries: Entry[]): Promise<void>

  protected abstract list(): Promise<void>

  protected abstract check(): Promise<void>

  protected abstract pending(entry: Entry): boolean
}
