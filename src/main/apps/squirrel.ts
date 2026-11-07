import * as z from 'zod'
import type { Bundle } from './bundle'
import { fetchFeed, verifySigner, type Feed, type Update } from './framework'
import { compare } from './version'

const Offer = z.object({ url: z.string(), name: z.string() })

type Source = {
  url: string
  changelog: string
}

async function check(bundle: Bundle, source: Source): Promise<Update | undefined> {
  const response = await fetchFeed(source.url)

  if (response.status === 204) return undefined

  const offer = Offer.parse(JSON.parse(await response.text()))

  // Some feeds, like Figma's, answer with their latest release even when that one is installed.
  if (compare(offer.name, bundle.version) <= 0) return undefined

  return {
    release: {
      version: offer.name,
      build: offer.name,
      date: undefined,
      url: new URL(offer.url, source.url).href,
      size: undefined,
      notes: { format: 'link', url: source.changelog }
    },
    verify: (_, replacement) => verifySigner(bundle.path, replacement)
  }
}

export function squirrelFeed(bundle: Bundle, source: Source): Feed {
  return { url: source.url, check: () => check(bundle, source) }
}
