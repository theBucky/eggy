import { DOMParser, onErrorStopParsing, type Element, type NodeList } from '@xmldom/xmldom'
import type { Notes, Release } from '$shared/api'
import { compare } from './version'

export type Appcast = {
  url: string
  channels: string[]
}

export type Enclosure = {
  url: string
  size: number | undefined
  signature: string | undefined
}

type Item = {
  release: Omit<Release, 'url' | 'size'>
  archive: Enclosure
  delta: Enclosure | undefined
}

const formats = ['html', 'markdown', 'plain-text'] as const

// Like Sparkle, this matches the `sparkle:` prefix by name, since some feeds bind it to the wrong
// namespace.
function sparkleText(item: Element, name: string): string | undefined {
  return item.getElementsByTagName(`sparkle:${name}`).item(0)?.textContent?.trim() || undefined
}

function localized(elements: NodeList<Element>): Element | undefined {
  const translations = [...elements]

  return (
    translations.find((element) => !element.getAttribute('xml:lang')) ??
    translations.find((element) => element.getAttribute('xml:lang')?.startsWith('en')) ??
    translations.at(0)
  )
}

function notesOf(item: Element, base: string): Notes | undefined {
  const description = localized(item.getElementsByTagName('description'))
  const text = description?.textContent?.trim()

  if (description !== undefined && text) {
    const format = description.getAttribute('sparkle:format')

    return { format: formats.find((known) => known === format) ?? 'html', text }
  }

  const url = (
    localized(item.getElementsByTagName('sparkle:releaseNotesLink')) ??
    localized(item.getElementsByTagName('sparkle:fullReleaseNotesLink'))
  )?.textContent?.trim()

  return url ? { format: 'link', url: new URL(url, base).href } : undefined
}

function runsHere(item: Element, { channels }: Appcast, system: string): boolean {
  const channel = sparkleText(item, 'channel')
  const minimum = sparkleText(item, 'minimumSystemVersion')
  const maximum = sparkleText(item, 'maximumSystemVersion')

  return (
    (channel === undefined || channels.includes(channel)) &&
    (process.arch === 'arm64' || !sparkleText(item, 'hardwareRequirements')?.includes('arm64')) &&
    (minimum === undefined || compare(minimum, system) <= 0) &&
    (maximum === undefined || compare(maximum, system) >= 0)
  )
}

function enclosureOf(element: Element | undefined, base: string): Enclosure | undefined {
  const url = element?.getAttribute('url')

  if (!element || !url) return undefined

  const size = Number(element.getAttribute('length'))

  return {
    url: new URL(url, base).href,
    size: size > 0 ? size : undefined,
    signature: element.getAttribute('sparkle:edSignature') || undefined
  }
}

function parseItem(
  item: Element,
  appcast: Appcast,
  system: string,
  installed: string
): Item | undefined {
  // Delta updates nest their own enclosures one level deeper.
  const enclosure = [...item.children].find((element) => element.tagName === 'enclosure')
  const archive = enclosureOf(enclosure, appcast.url)

  if (!enclosure || !archive || !runsHere(item, appcast, system)) return undefined

  // Sparkle 2 moved these from the enclosure's attributes to elements of the item.
  const field = (name: string): string | undefined =>
    enclosure.getAttribute(`sparkle:${name}`) || sparkleText(item, name)

  const build = field('version')

  if (build === undefined) return undefined

  const date = Date.parse(item.getElementsByTagName('pubDate').item(0)?.textContent ?? '')
  const deltas = item.getElementsByTagName('sparkle:deltas').item(0)

  const delta = [...(deltas?.children ?? [])].find(
    (element) => element.getAttribute('sparkle:deltaFrom') === installed
  )

  return {
    release: {
      version: field('shortVersionString') ?? build,
      build,
      date: Number.isNaN(date) ? undefined : date,
      notes: notesOf(item, appcast.url)
    },
    archive,
    delta: enclosureOf(delta, appcast.url)
  }
}

export function findItem(xml: string, appcast: Appcast, installed: string): Item | undefined {
  const document = new DOMParser({ onError: onErrorStopParsing }).parseFromString(xml, 'text/xml')
  const system = process.getSystemVersion()
  let newest: Item | undefined

  for (const item of document.getElementsByTagName('item')) {
    const parsed = parseItem(item, appcast, system, installed)

    if (parsed && (!newest || compare(parsed.release.build, newest.release.build) > 0)) {
      newest = parsed
    }
  }

  return newest && compare(newest.release.build, installed) > 0 ? newest : undefined
}
