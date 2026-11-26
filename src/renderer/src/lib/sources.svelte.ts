import { Apps } from '$lib/apps/apps.svelte'
import { Packages } from '$lib/packages/packages.svelte'
import { Repos } from '$lib/repos/repos.svelte'
import type { Bulk } from '$lib/source.svelte'

export class Sources {
  readonly apps = new Apps()
  readonly packages = new Packages()
  readonly repos = new Repos()
  readonly #all = [this.apps, this.packages, this.repos]
  scanning = $derived(this.#all.some((source) => source.scanning))
  checking = $derived(this.#all.some((source) => source.checking))
  busy = $derived(this.#all.some((source) => source.busy))
  checked = $derived(this.#all.some((source) => source.checked))
  checkFailed = $derived(this.#all.some((source) => source.checkFailed))
  outdated = $derived(this.#all.reduce((count, source) => count + source.outdated.length, 0))
  bulk = $derived.by<Bulk>(() => {
    const states = this.#all.map((source) => source.bulk)

    if (states.includes('ready')) return 'ready'

    return states.includes('running') ? 'running' : 'none'
  })

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
