import { MediaQuery } from 'svelte/reactivity'

export class IsMobile extends MediaQuery {
  constructor() {
    super('max-width: 767px')
  }
}
