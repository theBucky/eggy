import { invoke, on } from '$client/api'
import {
  OPTIMIZATIONS,
  type Machine,
  type Optimization,
  type OptimizeOutcome,
  type OptimizeState
} from '$shared/optimize'

export class Optimizer {
  machine = $state.raw<Machine>()
  batch = $state.raw<Optimization[]>([])
  #states = $state<Partial<Record<Optimization, OptimizeState>>>({})
  outcomes = $derived(OPTIMIZATIONS.flatMap((optimization) => this.outcomeOf(optimization) ?? []))
  done = $derived(
    this.batch.filter((optimization) => this.outcomeOf(optimization) !== undefined).length
  )
  running = $derived(this.done < this.batch.length)

  constructor() {
    on('optimization', (optimization, state) => {
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
    this.machine = await invoke('inspectMachine').catch(() => this.machine)
  }

  async optimize(optimizations: Optimization[]): Promise<void> {
    for (const optimization of optimizations) delete this.#states[optimization]

    this.batch = optimizations
    await invoke('optimize', optimizations)
    await this.inspect()
  }
}
