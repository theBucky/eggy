import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'jsonc-parser'
import type { Bundle } from './bundle'
import type { Feed, Framework } from './framework'
import { run } from './run'
import { sparkleFeed } from './sparkle'
import { squirrelFeed } from './squirrel'

const cursorTracks = ['stable', 'prerelease', 'dev', 'dogfood', 'candidate']

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
  [
    'pl.maketheweb.cleanshotx',
    async (bundle) =>
      sparkleFeed(bundle, {
        url: 'https://legit.maketheweb.io/api/v1/appcast',
        channels: [],
        preferences: { key: 'activationKey' }
      })
  ],
  // Ghostty, which picks a feed by the update channel its config resolves to. Ghostty's own loader
  // finds the config files and falls back to the channel of the installed build.
  [
    'com.mitchellh.ghostty',
    async (bundle) => {
      const config = await run(bundle.executable, ['+show-config'])
      const channel = /^auto-update-channel = tip$/m.test(config) ? 'tip' : 'release'

      return sparkleFeed(bundle, {
        url: `https://${channel}.files.ghostty.org/appcast.xml`,
        channels: []
      })
    }
  ],
  // Cursor, which asks for the release track picked in its settings.
  [
    'com.todesktop.230313mzl4w4u92',
    async (bundle) => {
      const settings: { 'update.releaseTrack'?: string } | undefined = parse(
        await readFile(
          join(homedir(), 'Library/Application Support/Cursor/User/settings.json'),
          'utf8'
        ).catch(() => '')
      )

      const track =
        cursorTracks.find((known) => known === settings?.['update.releaseTrack']) ?? 'stable'

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
  ]
])

export const knownApps: Framework = async (bundle) => feeds.get(bundle.id)?.(bundle)
