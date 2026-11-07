export class Preferences {
  #checkOnLaunch = $state(localStorage.getItem('checkOnLaunch') === 'true')

  get checkOnLaunch(): boolean {
    return this.#checkOnLaunch
  }

  set checkOnLaunch(value: boolean) {
    this.#checkOnLaunch = value
    localStorage.setItem('checkOnLaunch', String(value))
  }
}
