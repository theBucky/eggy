import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'jsonc-parser'
import * as z from 'zod'
import { output } from '../exec'
import type { Bundle } from './bundle'
import { fetchFeed, type Feed, type Framework } from './framework'
import { googleUpdaterFeed } from './google-updater'
import { readAppcast, sparkleFeed } from './sparkle'
import { squirrelFeed } from './squirrel'

const CursorSettings = z.object({
  'update.releaseTrack': z.enum(['stable', 'prerelease', 'dev', 'dogfood', 'candidate'])
})

// Cursor's update server requires a machine identifier but answers the same for any.
const anyMachine = '0'.repeat(64)

// Apps that pick their feed in code at launch, so these pick it the way the app does.
const feeds = new Map<string, (bundle: Bundle) => Promise<Feed>>([
  [
    'com.openai.codex',
    async (bundle) =>
      sparkleFeed(bundle, {
        url: 'https://persistent.oaistatic.com/codex-app-prod/appcast.xml',
        channels: []
      })
  ],
  // OrbStack, whose feed lags a release behind without a rollout bucket.
  [
    'dev.kdrag0n.MacVirt',
    async (bundle) =>
      sparkleFeed(bundle, {
        url: `https://api-updates.orbstack.dev/${process.arch === 'arm64' ? 'arm64' : 'amd64'}/appcast.xml?bucket=0`,
        channels: ['stable']
      })
  ],
  // CleanShot X, whose Info.plist feed ends at version 3 since later releases go to licensed copies.
  // The activation key joins the address only to fetch the feed, so neither the feed the app shows
  // nor a link the feed resolves carries it.
  [
    'pl.maketheweb.cleanshotx',
    async (bundle) => {
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
  // Ghostty, which picks a feed by the update channel its config resolves to. Ghostty's own loader
  // finds the config files and falls back to the channel of the installed build.
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

      const track = settings.success ? settings.data['update.releaseTrack'] : 'stable'

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
    async (bundle) => {
      const platform = process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64'

      return squirrelFeed(bundle, {
        url: `https://api2.cursor.sh/updates/api/update/${platform}/sand/${bundle.version}/${anyMachine}/stable`,
        changelog: 'https://x.ai/changelog/bot'
      })
    }
  ],
  // Chrome, whose updates hold the app itself, unlike Google apps that update through an installer
  // package.
  ['com.google.Chrome', async (bundle) => googleUpdaterFeed(bundle)],
  [
    'com.figma.Desktop',
    async (bundle) =>
      squirrelFeed(bundle, {
        url: `https://desktop.figma.com/${process.arch === 'arm64' ? 'mac-arm' : 'mac'}/RELEASE.json`,
        changelog: 'https://www.figma.com/release-notes/'
      })
  ]
])

export const knownApps: Framework = async (bundle) => feeds.get(bundle.id)?.(bundle)
