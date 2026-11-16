import type { Machine, Optimization, OptimizeOutcome, OptimizeState } from '$shared/api'

export class Optimizer {
  machine = $state<Machine>()
  #states = $state<Partial<Record<Optimization, OptimizeState>>>({})
  batch = $state<Optimization[]>([])
  running = $derived(this.batch.some((optimization) => this.outcomeOf(optimization) === undefined))

  constructor() {
    window.api.onOptimization((optimization, state) => {
      this.#states[optimization] = state
    })
  }

  outcomeOf(optimization: Optimization): OptimizeOutcome | undefined {
    const state = this.#states[optimization]

    return state?.status === 'running' ? undefined : state
  }

  isRunning(optimization: Optimization): boolean {
    return this.#states[optimization]?.status === 'running'
  }

  async inspect(): Promise<void> {
    this.machine = await window.api.inspectMachine()
  }

  async optimize(optimizations: Optimization[]): Promise<void> {
    for (const optimization of optimizations) delete this.#states[optimization]

    this.batch = optimizations
    await window.api.optimize(optimizations)
    await this.inspect()
  }
}
