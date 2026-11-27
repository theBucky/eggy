export class Pool {
  readonly #size: number
  readonly #running = new Set<string>()
  readonly #waiting: { key: string; start: () => void }[] = []

  constructor(size: number) {
    this.#size = size
  }

  async run(key: string, task: () => Promise<void>): Promise<void> {
    const { promise, resolve } = Promise.withResolvers<void>()

    this.#waiting.push({ key, start: resolve })
    this.#next()
    await promise

    try {
      await task()
    } finally {
      this.#running.delete(key)
      this.#next()
    }
  }

  #next(): void {
    while (this.#running.size < this.#size) {
      const next = this.#waiting.find(({ key }) => !this.#running.has(key))

      if (next === undefined) return

      this.#waiting.splice(this.#waiting.indexOf(next), 1)
      this.#running.add(next.key)
      next.start()
    }
  }
}
