export class Serial {
  #tail: Promise<unknown> = Promise.resolve()

  run<T>(task: () => Promise<T>): Promise<T> {
    const done = this.#tail.then(task)

    this.#tail = done

    return done
  }
}
