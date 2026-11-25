import type { App } from '$shared/apps'

export class QuitPrompt {
  open = $state(false)
  apps = $state<App[]>([])
  #quit = Promise.withResolvers<boolean>()

  ask(app: App): Promise<boolean> {
    if (!this.open) {
      this.open = true
      this.apps = []
      this.#quit = Promise.withResolvers()
    }

    this.apps.push(app)

    return this.#quit.promise
  }

  answer(quit: boolean): void {
    this.open = false
    this.#quit.resolve(quit)
  }
}
