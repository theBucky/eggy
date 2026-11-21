import type { App } from '$shared/apps'

export class QuitPrompt {
  open = $state(false)
  // Kept after closing, so the dialog fades out with the apps it named.
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
