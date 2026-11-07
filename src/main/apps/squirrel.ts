import type { Bundle } from './bundle'
import { verifySigner } from './codesign'
import { fetchFeed, type Feed, type Update } from './framework'

type Source = {
  url: string
  changelog: string
}

async function check(bundle: Bundle, source: Source): Promise<Update | undefined> {
  const response = await fetchFeed(source.url)

  if (response.status === 204) return undefined

  const body: { url: string; name: string } = JSON.parse(await response.text())

  return {
    release: {
      version: body.name,
      build: body.name,
      date: undefined,
      url: new URL(body.url, source.url).href,
      size: undefined,
      notes: { format: 'link', url: source.changelog }
    },
    verify: (_, replacement) => verifySigner(bundle.path, replacement)
  }
}

export function squirrelFeed(bundle: Bundle, source: Source): Feed {
  return { url: source.url, check: () => check(bundle, source) }
}
