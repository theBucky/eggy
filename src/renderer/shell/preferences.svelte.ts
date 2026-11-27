import { invoke, theme } from '$client/api'
import type { Theme } from '$shared/theme'

export class Preferences {
  #checkOnLaunch = $state(localStorage.getItem('checkOnLaunch') === 'true')
  #theme = $state(theme)

  get checkOnLaunch(): boolean {
    return this.#checkOnLaunch
  }

  set checkOnLaunch(value: boolean) {
    this.#checkOnLaunch = value
    localStorage.setItem('checkOnLaunch', String(value))
  }

  get theme(): Theme {
    return this.#theme
  }

  set theme(value: Theme) {
    this.#theme = value
    invoke('setTheme', value)
  }
}
