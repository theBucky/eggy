import { createPublicKey, verify } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { findItem, type Appcast } from './appcast'
import type { Bundle } from './bundle'
import { fetchFeed, type Feed, type Framework, type Update } from './framework'
import { run } from './run'

type Source = Appcast & {
  preferences?: Record<string, string>
}

// Apps that set their feed in code at launch leave it out of Info.plist or name an outdated one there,
// so these pick it the way the app does.
const knownSources = new Map<string, (bundle: Bundle) => Promise<Source>>([
  [
    'com.openai.codex',
    async () => ({
      url: 'https://persistent.oaistatic.com/codex-app-prod/appcast.xml',
      channels: []
    })
  ],
  // OrbStack, whose feed lags a release behind without a rollout bucket.
  [
    'dev.kdrag0n.MacVirt',
    async () => ({
      url: `https://api-updates.orbstack.dev/${process.arch === 'arm64' ? 'arm64' : 'amd64'}/appcast.xml?bucket=0`,
      channels: ['stable']
    })
  ],
  // CleanShot X, whose Info.plist feed ends at version 3 since later releases go to licensed copies.
  [
    'pl.maketheweb.cleanshotx',
    async () => ({
      url: 'https://legit.maketheweb.io/api/v1/appcast',
      channels: [],
      preferences: { key: 'activationKey' }
    })
  ],
  // Ghostty, which picks a feed by the update channel its config resolves to. Ghostty's own loader
  // finds the config files and falls back to the channel of the installed build.
  [
    'com.mitchellh.ghostty',
    async ({ executable }) => {
      const config = await run(executable, ['+show-config'])
      const channel = /^auto-update-channel = tip$/m.test(config) ? 'tip' : 'release'

      return { url: `https://${channel}.files.ghostty.org/appcast.xml`, channels: [] }
    }
  ]
])

function verifySignature(archive: Buffer, signature: string | undefined, key: string): void {
  if (signature === undefined) {
    throw new Error('The update is unsigned, but the app expects a signature.')
  }

  const publicKey = createPublicKey({
    key: { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(key, 'base64').toString('base64url') },
    format: 'jwk'
  })

  if (!verify(null, archive, publicKey, Buffer.from(signature, 'base64'))) {
    throw new Error("The update's signature doesn't match the app's key.")
  }
}

async function check(bundle: Bundle, source: Source): Promise<Update | undefined> {
  const url = new URL(source.url)

  for (const [parameter, key] of Object.entries(source.preferences ?? {})) {
    url.searchParams.set(parameter, (await run('defaults', ['read', bundle.id, key])).trim())
  }

  const response = await fetchFeed(url.href)
  const item = findItem(await response.text(), source, bundle.build)

  if (item === undefined) return undefined

  const key = bundle.info.get('SUPublicEDKey')

  return {
    release: item.release,
    verify: async (archive) => {
      if (key !== undefined) verifySignature(await readFile(archive), item.signature, key)
    }
  }
}

async function sourceOf(bundle: Bundle): Promise<Source | undefined> {
  const known = knownSources.get(bundle.id)

  if (known !== undefined) return known(bundle)

  const url = bundle.info.get('SUFeedURL')

  return url === undefined ? undefined : { url, channels: [] }
}

async function locate(bundle: Bundle): Promise<Feed | undefined> {
  const source = await sourceOf(bundle)

  return source && { url: source.url, check: () => check(bundle, source) }
}

export const sparkle: Framework = { marker: 'Frameworks/Sparkle.framework', locate }
