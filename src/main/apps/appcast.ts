import { DOMParser, onErrorStopParsing, type Element, type NodeList } from '@xmldom/xmldom'
import type { Notes, Release } from '../../shared/api'

export type Appcast = {
  url: string
  channels: string[]
}

type Item = {
  release: Release
  signature: string | undefined
}

const formats = ['html', 'markdown', 'plain-text'] as const

type Kind = 'number' | 'string' | 'period' | 'separator' | 'dash'

function kindOf(part: string): Kind {
  if (part === '.') return 'period'

  if (part === '-') return 'dash'

  if (/^\p{Nd}/u.test(part)) return 'number'

  if (/^[\s\p{P}]/u.test(part)) return 'separator'

  return 'string'
}

function separates(kind: Kind): boolean {
  return kind === 'period' || kind === 'separator'
}

// a dash ends the version so a trailing commit hash never counts.
function split(version: string): string[] {
  const parts: string[] = []

  for (const char of version) {
    const kind = kindOf(char)
    const last = parts.at(-1)

    if (last !== undefined && kind === 'dash') break

    if (last === undefined || kind !== kindOf(last) || separates(kindOf(last))) parts.push(char)
    else parts[parts.length - 1] = last + char
  }

  return parts
}

function leadingNumbers(parts: string[]): number {
  const end = parts.findIndex((part) => kindOf(part) !== 'number' && kindOf(part) !== 'period')

  return end === -1 ? parts.length : end
}

function pad(shorter: string[], longer: string[]): void {
  for (let index = leadingNumbers(shorter); index < leadingNumbers(longer); index++) {
    shorter.splice(index, 0, kindOf(longer[index]) === 'period' ? '.' : '0')
  }
}

// follows sparkle's SUStandardVersionComparator rather than semver.
export function compare(a: string, b: string): number {
  const partsA = split(a)
  const partsB = split(b)

  pad(partsA, partsB)
  pad(partsB, partsA)

  const shared = Math.min(partsA.length, partsB.length)

  for (let index = 0; index < shared; index++) {
    const partA = partsA[index]
    const partB = partsB[index]
    const kindA = kindOf(partA)
    const kindB = kindOf(partB)

    if (kindA === kindB || (separates(kindA) && separates(kindB))) {
      if (kindA === 'number' && Number(partA) !== Number(partB)) {
        return Number(partA) > Number(partB) ? 1 : -1
      }

      if (kindA === 'string' && partA !== partB) return partA > partB ? 1 : -1
    } else if (kindB === 'string') {
      return 1
    } else {
      return kindA === 'number' ? 1 : -1
    }
  }

  if (partsA.length === partsB.length) return 0

  const longer = partsA.length > partsB.length ? partsA : partsB
  const newerIsLonger = kindOf(longer[shared]) !== 'string'

  return partsA.length > partsB.length === newerIsLonger ? 1 : -1
}

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

function parseItem(item: Element, appcast: Appcast, system: string): Item | undefined {
  // Delta updates nest their own enclosures one level deeper.
  const enclosure = [...item.children].find((element) => element.tagName === 'enclosure')
  const url = enclosure?.getAttribute('url')

  if (!enclosure || !url || !runsHere(item, appcast, system)) return undefined

  // Sparkle 2 moved these from the enclosure's attributes to elements of the item.
  const field = (name: string): string | undefined =>
    enclosure.getAttribute(`sparkle:${name}`) || sparkleText(item, name)

  const build = field('version')

  if (build === undefined) return undefined

  const date = Date.parse(item.getElementsByTagName('pubDate').item(0)?.textContent ?? '')
  const size = Number(enclosure.getAttribute('length'))

  return {
    release: {
      version: field('shortVersionString') ?? build,
      build,
      date: Number.isNaN(date) ? undefined : date,
      url: new URL(url, appcast.url).href,
      size: size > 0 ? size : undefined,
      notes: notesOf(item, appcast.url)
    },
    signature: enclosure.getAttribute('sparkle:edSignature') || undefined
  }
}

export function findItem(xml: string, appcast: Appcast, installed: string): Item | undefined {
  const document = new DOMParser({ onError: onErrorStopParsing }).parseFromString(xml, 'text/xml')
  const system = process.getSystemVersion()
  let newest: Item | undefined

  for (const item of document.getElementsByTagName('item')) {
    const parsed = parseItem(item, appcast, system)

    if (parsed && (!newest || compare(parsed.release.build, newest.release.build) > 0)) {
      newest = parsed
    }
  }

  return newest && compare(newest.release.build, installed) > 0 ? newest : undefined
}
