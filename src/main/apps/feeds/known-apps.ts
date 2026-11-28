import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'jsonc-parser'
import { prerelease } from 'semver'
import * as z from 'zod'
import { output } from '$platform/exec'
import { genericFeed, offerGitHubRelease } from './electron-updater'
import { fetchFeed, type Framework } from './feed'
import { githubReleasesFeed } from './github-releases'
import { googleUpdaterFeed } from './google-updater'
import { readAppcast, sparkleFeed } from './sparkle'
import { squirrelFeed } from './squirrel'

function cursorUpdateUrl(product: 'cursor' | 'sand', version: string, track: string): string {
  const intel = product === 'cursor' ? 'darwin' : 'darwin-x64'
  const platform = process.arch === 'arm64' ? 'darwin-arm64' : intel

  // The endpoint requires a machine ID but does not use it to select the update.
  return `https://api2.cursor.sh/updates/api/update/${platform}/${product}/${version}/${'0'.repeat(64)}/${track}`
}

export const knownApps: Framework = async (bundle) => {
  switch (bundle.id) {
    case 'com.openai.codex':
      return sparkleFeed(bundle, {
        url: 'https://persistent.oaistatic.com/codex-app-prod/appcast.xml'
      })
    case 'dev.kdrag0n.MacVirt':
      // Without a rollout bucket the feed lags one release behind.
      return sparkleFeed(bundle, {
        url: `https://api-updates.orbstack.dev/${process.arch === 'arm64' ? 'arm64' : 'amd64'}/appcast.xml?bucket=0`,
        channel: 'stable'
      })
    case 'pl.maketheweb.cleanshotx': {
      // The bundled public feed stops at version 3.
      const appcast = { url: 'https://legit.maketheweb.io/api/v1/appcast' }

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

    case 'com.mitchellh.ghostty': {
      const config = await output(bundle.executable, ['+show-config'])
      const channel = /^auto-update-channel = tip$/m.test(config) ? 'tip' : 'release'

      return sparkleFeed(bundle, { url: `https://${channel}.files.ghostty.org/appcast.xml` })
    }

    case 'com.todesktop.230313mzl4w4u92': {
      const path = join(homedir(), 'Library/Application Support/Cursor/User/settings.json')
      const text = await readFile(path, 'utf8').catch(() => '')

      const track = z
        .enum(['stable', 'prerelease', 'dev', 'dogfood', 'candidate'])
        .optional()
        .catch(undefined)

      const { data } = z
        .object({ 'update.releaseTrackOverride': track, 'update.releaseTrack': track })
        .safeParse(parse(text))

      const channel =
        data?.['update.releaseTrackOverride'] ?? data?.['update.releaseTrack'] ?? 'stable'

      return squirrelFeed(bundle, {
        url: cursorUpdateUrl('cursor', bundle.version, channel),
        changelog: 'https://cursor.com/changelog'
      })
    }

    case 'com.anysphere.sand':
      return squirrelFeed(bundle, {
        url: cursorUpdateUrl('sand', bundle.version, 'stable'),
        changelog: 'https://x.ai/changelog/bot'
      })
    case 'com.t3tools.t3code': {
      const channel = prerelease(bundle.version)?.[0]

      if (channel !== 'nightly') return undefined

      const releases = 'https://github.com/pingdotgg/t3code/releases'

      return {
        url: releases,
        check: async () => {
          // Mobile releases can push nightlies out of the GitHub release feed.
          const response = await fetchFeed(`${releases}/download/update-feed/${channel}.json`)

          const { tag_name, body } = z
            .object({ tag_name: z.string(), body: z.string().nullish() })
            .parse(await response.json())

          return offerGitHubRelease(
            bundle,
            releases,
            tag_name,
            channel,
            body ? { format: 'markdown', text: body } : undefined
          )
        }
      }
    }

    case 'com.google.antigravity':
      // The bundled app-update.yml omits the architecture from the channel.
      return genericFeed(bundle, {
        url: 'https://antigravity-hub-auto-updater-974169037036.us-central1.run.app/manifest/',
        channel: `latest-${process.arch}`
      })
    case 'com.google.Chrome':
      return googleUpdaterFeed(bundle)
    case 'com.figma.Desktop':
      return squirrelFeed(bundle, {
        url: `https://desktop.figma.com/${process.arch === 'arm64' ? 'mac-arm' : 'mac'}/RELEASE.json`,
        changelog: 'https://www.figma.com/release-notes/'
      })
    case 'com.yubico.yubioath':
      return githubReleasesFeed(bundle, { repo: 'Yubico/yubioath-flutter', asset: /-macos\.dmg$/ })
    default:
      return undefined
  }
}
