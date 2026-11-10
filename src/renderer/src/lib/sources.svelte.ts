export type Source = {
  readonly scanning: boolean
  readonly checking: boolean
  readonly upgrading: boolean
  readonly busy: boolean
  readonly checked: boolean
  readonly checkFailed: boolean
  readonly outdated: readonly object[]
  scan: () => Promise<void>
  refresh: () => Promise<void>
  upgradeOutdated: () => Promise<void>
}

export class Sources implements Source {
  // TypeScript rejects a field initializer that reads `#all` before the constructor assigns it, so
  // each derived reads it through a thunk.
  readonly #all: Source[]
  scanning = $derived.by(() => this.#all.some((source) => source.scanning))
  checking = $derived.by(() => this.#all.some((source) => source.checking))
  upgrading = $derived.by(() => this.#all.some((source) => source.upgrading))
  busy = $derived.by(() => this.#all.some((source) => source.busy))
  checked = $derived.by(() => this.#all.some((source) => source.checked))
  checkFailed = $derived.by(() => this.#all.some((source) => source.checkFailed))
  outdated = $derived.by(() => this.#all.flatMap((source) => source.outdated))

  constructor(all: Source[]) {
    this.#all = all
  }

  async scan(): Promise<void> {
    await Promise.all(this.#all.map((source) => source.scan()))
  }

  async refresh(): Promise<void> {
    await Promise.all(this.#all.map((source) => source.refresh()))
  }

  async upgradeOutdated(): Promise<void> {
    await Promise.all(this.#all.map((source) => source.upgradeOutdated()))
  }
}
