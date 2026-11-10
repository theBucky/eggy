import type { Status } from '$lib/status'
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

  statusOf(optimization: Optimization): Status {
    const state = this.#states[optimization]

    if (state === undefined) return 'unknown'

    switch (state.status) {
      case 'skipped':
      case 'unavailable':
        return 'unknown'
      case 'applied':
      case 'unchanged':
        return 'current'
      default:
        return state.status
    }
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
