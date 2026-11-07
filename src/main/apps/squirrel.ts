import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'jsonc-parser'
import type { Bundle } from './bundle'
import { verifySigner } from './codesign'
import { fetchFeed, type Feed, type Framework, type Update } from './framework'

type Source = {
  url: string
  changelog: string
}

const cursorTracks = ['stable', 'prerelease', 'dev', 'dogfood', 'candidate']

// Cursor's update server requires a machine identifier but answers the same for any.
const anyMachine = '0'.repeat(64)

// Squirrel apps build their feed in code, so these build it the way the app does.
const knownSources = new Map<string, (bundle: Bundle) => Promise<Source>>([
  // Cursor, which asks for the release track picked in its settings.
  [
    'com.todesktop.230313mzl4w4u92',
    async ({ version }) => {
      const settings: { 'update.releaseTrack'?: string } | undefined = parse(
        await readFile(
          join(homedir(), 'Library/Application Support/Cursor/User/settings.json'),
          'utf8'
        ).catch(() => '')
      )

      const track =
        cursorTracks.find((known) => known === settings?.['update.releaseTrack']) ?? 'stable'

      const platform = process.arch === 'arm64' ? 'darwin-arm64' : 'darwin'

      return {
        url: `https://api2.cursor.sh/updates/api/update/${platform}/cursor/${version}/${anyMachine}/${track}`,
        changelog: 'https://cursor.com/changelog'
      }
    }
  ],
  // Grok Bot, whose other release tracks are internal.
  [
    'com.anysphere.sand',
    async ({ version }) => {
      const platform = process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64'

      return {
        url: `https://api2.cursor.sh/updates/api/update/${platform}/sand/${version}/${anyMachine}/stable`,
        changelog: 'https://x.ai/changelog/bot'
      }
    }
  ]
])

async function check(installed: string, source: Source): Promise<Update | undefined> {
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
    verify: (_, replacement) => verifySigner(installed, replacement)
  }
}

async function locate(bundle: Bundle): Promise<Feed | undefined> {
  const source = await knownSources.get(bundle.id)?.(bundle)

  return source && { url: source.url, check: () => check(bundle.path, source) }
}

export const squirrel: Framework = { marker: 'Frameworks/Squirrel.framework', locate }
