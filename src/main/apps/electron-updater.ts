import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DOMParser, onErrorStopParsing } from '@xmldom/xmldom'
import { gt, prerelease, valid } from 'semver'
import { parse } from 'yaml'
import * as z from 'zod'
import type { Notes } from '../../shared/api'
import type { Bundle } from './bundle'
import {
  fetchFeed,
  verifyChecksum,
  verifySigner,
  type Feed,
  type Framework,
  type Update
} from './framework'

const Generic = z.object({
  provider: z.literal('generic'),
  url: z.string(),
  channel: z.string().optional()
})

type Generic = z.infer<typeof Generic>

const GitHub = z.object({
  provider: z.literal('github'),
  owner: z.string(),
  repo: z.string(),
  channel: z.string().optional()
})

type GitHub = z.infer<typeof GitHub>

const Config = z.discriminatedUnion('provider', [Generic, GitHub])

const File = z.object({
  url: z.string(),
  sha512: z.string(),
  size: z.number().optional()
})

type File = z.infer<typeof File>

const Info = z.object({
  version: z.string(),
  files: z.array(File),
  releaseDate: z.string().optional()
})

type Info = z.infer<typeof Info>

const LatestRelease = z.object({ tag_name: z.string() })

type Channel = string | number | undefined

const tagLink = /\/tag\/(v?[^/]+)$/

async function fetchInfo(url: string): Promise<Info> {
  return Info.parse(parse(await (await fetchFeed(url)).text()))
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
      await verifyChecksum(archive, 'sha512', 'base64', file.sha512)
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
    const response = await fetchFeed(`${releases}/latest`, {
      headers: { accept: 'application/json' }
    })

    return LatestRelease.parse(JSON.parse(await response.text())).tag_name
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

export const electronUpdater: Framework = async (bundle) => {
  const path = join(bundle.path, 'Contents/Resources/app-update.yml')

  if (!existsSync(path)) return undefined

  const config = Config.safeParse(parse(await readFile(path, 'utf8')))

  if (!config.success) return undefined

  return config.data.provider === 'generic'
    ? generic(bundle, config.data)
    : github(bundle, config.data)
}
