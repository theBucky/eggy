import { Apps } from '$lib/apps/apps.svelte'
import { Packages } from '$lib/packages/packages.svelte'
import { Repos } from '$lib/repos/repos.svelte'

export class Sources {
  readonly apps = new Apps()
  readonly packages = new Packages()
  readonly repos = new Repos()
  readonly #all = [this.apps, this.packages, this.repos]
  scanning = $derived(this.#all.some((source) => source.scanning))
  checking = $derived(this.#all.some((source) => source.checking))
  bulk = $derived(this.#all.some((source) => source.bulk))
  busy = $derived(this.#all.some((source) => source.busy))
  checked = $derived(this.#all.some((source) => source.checked))
  checkFailed = $derived(this.#all.some((source) => source.checkFailed))
  outdated = $derived(this.#all.reduce((count, source) => count + source.outdated.length, 0))

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
