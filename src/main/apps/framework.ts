import { net } from 'electron'
import type { Release } from '../../shared/api'
import type { Bundle } from './bundle'

export type Update = {
  release: Release
  verify: (archive: string, replacement: string) => Promise<void>
}

export type Feed = {
  url: string
  check: () => Promise<Update | undefined>
}

export type Framework = (bundle: Bundle) => Promise<Feed | undefined>

export async function fetchFeed(url: string, accept = '*/*'): Promise<Response> {
  const response = await net.fetch(url, { headers: { accept } })

  if (!response.ok) throw new Error(`The update feed answered with HTTP ${response.status}.`)

  return response
}
