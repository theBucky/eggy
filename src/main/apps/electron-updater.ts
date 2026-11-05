import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DOMParser, onErrorStopParsing } from '@xmldom/xmldom'
import { gt, prerelease, valid } from 'semver'
import { parse } from 'yaml'
import type { Notes } from '../../shared/api'
import type { Bundle } from './bundle'
import { verifySigner } from './codesign'
import { fetchFeed, type Feed, type Framework, type Update } from './framework'

type Generic = {
  provider: 'generic'
  url: string
  channel?: string
}

type GitHub = {
  provider: 'github'
  owner: string
  repo: string
  channel?: string
}

type File = {
  url: string
  sha512: string
  size?: number
}

type Info = {
  version: string
  files: File[]
  releaseDate?: string
}

type Channel = string | number | undefined

const tagLink = /\/tag\/(v?[^/]+)$/

async function fetchInfo(url: string): Promise<Info> {
  return parse(await (await fetchFeed(url)).text())
}

// Like electron-updater, an arm64 Mac takes arm64 archives when the release has any.
function pickArchive(files: File[]): File {
  const isArm = (file: File): boolean => file.url.includes('arm64')
  const native = process.arch === 'arm64' && files.some(isArm)
  const zips = files.filter((file) => isArm(file) === native && file.url.endsWith('.zip'))
  const zip = zips.find((file) => file.url.includes(process.arch)) ?? zips.at(0)

  if (zip === undefined) throw new Error('The update offers no zip archive for this Mac.')

  return zip
}

async function verifyChecksum(archive: string, sha512: string): Promise<void> {
  const hash = createHash('sha512')

  for await (const chunk of createReadStream(archive)) hash.update(chunk)

  if (hash.digest('base64') !== sha512) {
    throw new Error("The download doesn't match the update's checksum.")
  }
}

function offer(bundle: Bundle, info: Info, base: string, notes?: Notes): Update | undefined {
  if (!gt(info.version, bundle.version)) return undefined

  const file = pickArchive(info.files)
  const date = Date.parse(info.releaseDate ?? '')

  return {
    release: {
      version: info.version,
      build: info.version,
      date: Number.isNaN(date) ? undefined : date,
      url: new URL(file.url, base).href,
      size: file.size,
      notes
    },
    verify: async (archive, replacement) => {
      await verifyChecksum(archive, file.sha512)
      await verifySigner(bundle.path, replacement)
    }
  }
}

function generic(bundle: Bundle, { url, channel = 'latest' }: Generic): Feed {
  const base = url.endsWith('/') ? url : `${url}/`
  const file = new URL(`${channel}-mac.yml`, base).href

  return { url: file, check: async () => offer(bundle, await fetchInfo(file), base) }
}

// Like electron-updater, alpha and beta builds also take stable and newer beta releases, while
// other prerelease channels keep to their own.
function follows(installed: Channel, candidate: Channel): boolean {
  if (installed === 'alpha' || installed === 'beta') {
    return candidate === undefined || candidate === 'beta' || candidate === installed
  }

  return candidate === installed
}

type Entry = {
  tag: string | undefined
  content: string | undefined
}

async function findTag(
  releases: string,
  entries: Entry[],
  installed: string
): Promise<string | undefined> {
  const channel = prerelease(installed)?.[0]

  if (channel === undefined) {
    const latest: { tag_name: string } = await (
      await fetchFeed(`${releases}/latest`, 'application/json')
    ).json()

    return latest.tag_name
  }

  return entries.find(
    ({ tag }) => tag !== undefined && valid(tag) && follows(channel, prerelease(tag)?.[0])
  )?.tag
}

function github(bundle: Bundle, config: GitHub): Feed {
  const releases = `https://github.com/${config.owner}/${config.repo}/releases`

  return {
    url: releases,
    check: async () => {
      const atom = await (await fetchFeed(`${releases}.atom`)).text()

      const entries = [
        ...new DOMParser({ onError: onErrorStopParsing })
          .parseFromString(atom, 'text/xml')
          .getElementsByTagName('entry')
      ].map((entry): Entry => ({
        tag: tagLink.exec(
          entry.getElementsByTagName('link').item(0)?.getAttribute('href') ?? ''
        )?.[1],
        content: entry.getElementsByTagName('content').item(0)?.textContent?.trim()
      }))

      const tag = await findTag(releases, entries, bundle.version)

      if (tag === undefined) throw new Error('The repository has no release for this channel.')

      const base = `${releases}/download/${tag}/`
      const channel = prerelease(tag)?.[0] ?? config.channel ?? 'latest'
      const info = await fetchInfo(`${base}${channel}-mac.yml`)
      const content = entries.find((entry) => entry.tag === tag)?.content

      // GitHub fills in an empty description with this placeholder.
      const notes: Notes | undefined =
        content && content !== 'No content.' ? { format: 'html', text: content } : undefined

      // electron-builder uploads files to GitHub with dashes in place of spaces.
      const files = info.files.map((file) => ({ ...file, url: file.url.replaceAll(' ', '-') }))

      return offer(bundle, { ...info, files }, base, notes)
    }
  }
}

async function locate(bundle: Bundle): Promise<Feed | undefined> {
  const config: Generic | GitHub = parse(
    await readFile(join(bundle.path, 'Contents/Resources/app-update.yml'), 'utf8')
  )

  if (config.provider === 'generic') return generic(bundle, config)

  if (config.provider === 'github') return github(bundle, config)

  return undefined
}

export const electronUpdater: Framework = { marker: 'Resources/app-update.yml', locate }
