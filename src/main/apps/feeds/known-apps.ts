import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'jsonc-parser'
import { prerelease } from 'semver'
import * as z from 'zod'
import { output } from '../../exec'
import type { Bundle } from '../bundle'
import { genericFeed, offerGitHubRelease } from './electron-updater'
import { fetchFeed, type Feed, type Framework } from './feed'
import { googleUpdaterFeed } from './google-updater'
import { readAppcast, sparkleFeed } from './sparkle'
import { squirrelFeed } from './squirrel'

const CursorTrack = z
  .enum(['stable', 'prerelease', 'dev', 'dogfood', 'candidate'])
  .optional()
  .catch(undefined)

const CursorSettings = z.object({
  'update.releaseTrackOverride': CursorTrack,
  'update.releaseTrack': CursorTrack
})

// Cursor's update server requires a machine identifier but answers the same for any.
const anyMachine = '0'.repeat(64)

const T3Pointer = z.object({ tag_name: z.string(), body: z.string().nullish() })

const feeds = new Map<string, (bundle: Bundle) => Feed | undefined | Promise<Feed>>([
  [
    'com.openai.codex',
    (bundle) =>
      sparkleFeed(bundle, {
        url: 'https://persistent.oaistatic.com/codex-app-prod/appcast.xml',
        channels: []
      })
  ],
  // OrbStack, whose feed lags a release behind without a rollout bucket.
  [
    'dev.kdrag0n.MacVirt',
    (bundle) =>
      sparkleFeed(bundle, {
        url: `https://api-updates.orbstack.dev/${process.arch === 'arm64' ? 'arm64' : 'amd64'}/appcast.xml?bucket=0`,
        channels: ['stable']
      })
  ],
  // CleanShot X, whose Info.plist feed ends at version 3 since later releases go to licensed copies.
  [
    'pl.maketheweb.cleanshotx',
    (bundle) => {
      const appcast = { url: 'https://legit.maketheweb.io/api/v1/appcast', channels: [] }

      return {
        url: appcast.url,
        check: async () => {
          const licensed = new URL(appcast.url)
          const key = await output('/usr/bin/defaults', ['read', bundle.id, 'activationKey'])

          licensed.searchParams.set('key', key.trim())

          return readAppcast(bundle, await (await fetchFeed(licensed.href)).text(), appcast)
        }
      }
    }
  ],
  [
    'com.mitchellh.ghostty',
    async (bundle) => {
      const config = await output(bundle.executable, ['+show-config'])
      const channel = /^auto-update-channel = tip$/m.test(config) ? 'tip' : 'release'

      return sparkleFeed(bundle, {
        url: `https://${channel}.files.ghostty.org/appcast.xml`,
        channels: []
      })
    }
  ],
  [
    'com.todesktop.230313mzl4w4u92',
    async (bundle) => {
      const settings = CursorSettings.safeParse(
        parse(
          await readFile(
            join(homedir(), 'Library/Application Support/Cursor/User/settings.json'),
            'utf8'
          ).catch(() => '')
        )
      )

      const track =
        settings.data?.['update.releaseTrackOverride'] ??
        settings.data?.['update.releaseTrack'] ??
        'stable'

      const platform = process.arch === 'arm64' ? 'darwin-arm64' : 'darwin'

      return squirrelFeed(bundle, {
        url: `https://api2.cursor.sh/updates/api/update/${platform}/cursor/${bundle.version}/${anyMachine}/${track}`,
        changelog: 'https://cursor.com/changelog'
      })
    }
  ],
  // Grok Bot, whose other release tracks are internal.
  [
    'com.anysphere.sand',
    (bundle) => {
      const platform = process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64'

      return squirrelFeed(bundle, {
        url: `https://api2.cursor.sh/updates/api/update/${platform}/sand/${bundle.version}/${anyMachine}/stable`,
        changelog: 'https://x.ai/changelog/bot'
      })
    }
  ],
  // T3 Code, whose nightly builds read a pointer to the newest nightly, since the repository's other
  // releases crowd nightlies out of GitHub's release feed.
  [
    'com.t3tools.t3code',
    (bundle) => {
      const channel = prerelease(bundle.version)?.[0]

      if (channel !== 'nightly') return undefined

      const releases = 'https://github.com/pingdotgg/t3code/releases'

      return {
        url: releases,
        check: async () => {
          const pointer = T3Pointer.parse(
            await (await fetchFeed(`${releases}/download/update-feed/${channel}.json`)).json()
          )

          return offerGitHubRelease(
            bundle,
            releases,
            pointer.tag_name,
            channel,
            pointer.body ? { format: 'markdown', text: pointer.body } : undefined
          )
        }
      }
    }
  ],
  // Antigravity, whose app-update.yml omits the per-architecture channel the app sets in code.
  [
    'com.google.antigravity',
    (bundle) =>
      genericFeed(bundle, {
        url: 'https://antigravity-hub-auto-updater-974169037036.us-central1.run.app/manifest/',
        channel: `latest-${process.arch}`
      })
  ],
  // Chrome, whose updates hold the app itself, unlike Google apps that update through an installer
  // package.
  ['com.google.Chrome', googleUpdaterFeed],
  [
    'com.figma.Desktop',
    (bundle) =>
      squirrelFeed(bundle, {
        url: `https://desktop.figma.com/${process.arch === 'arm64' ? 'mac-arm' : 'mac'}/RELEASE.json`,
        changelog: 'https://www.figma.com/release-notes/'
      })
  ]
])

export const knownApps: Framework = async (bundle) => feeds.get(bundle.id)?.(bundle)
