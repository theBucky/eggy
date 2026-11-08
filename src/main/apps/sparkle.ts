import { createPublicKey, verify } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { findItem, type Appcast } from './appcast'
import type { Bundle } from './bundle'
import { fetchFeed, verifySigner, type Feed, type Framework, type Update } from './framework'
import { run } from './run'

type Source = Appcast & {
  preferences?: Record<string, string>
}

const verifyAsync = promisify(verify)

async function verifySignature(
  archive: string,
  signature: string | undefined,
  key: string
): Promise<void> {
  if (signature === undefined) {
    throw new Error('The update is unsigned, but the app expects a signature.')
  }

  const publicKey = createPublicKey({
    key: { kty: 'OKP', crv: 'Ed25519', x: Buffer.from(key, 'base64').toString('base64url') },
    format: 'jwk'
  })

  const matches = await verifyAsync(
    null,
    await readFile(archive),
    publicKey,
    Buffer.from(signature, 'base64')
  )

  if (!matches) throw new Error("The update's signature doesn't match the app's key.")
}

async function check(bundle: Bundle, source: Source): Promise<Update[]> {
  const url = new URL(source.url)

  for (const [parameter, key] of Object.entries(source.preferences ?? {})) {
    url.searchParams.set(parameter, (await run('defaults', ['read', bundle.id, key])).trim())
  }

  const response = await fetchFeed(url.href)
  const item = findItem(await response.text(), source, bundle.build)

  if (item === undefined) return []

  const key = bundle.info.get('SUPublicEDKey')

  return [
    {
      release: item.release,
      // Like Sparkle, an app without an EdDSA key trusts an update by its code signature instead.
      verify: (archive, replacement) =>
        key === undefined
          ? verifySigner(bundle.path, replacement)
          : verifySignature(archive, item.signature, key)
    }
  ]
}

export function sparkleFeed(bundle: Bundle, source: Source): Feed {
  return { url: source.url, check: () => check(bundle, source) }
}

export const sparkle: Framework = async (bundle) => {
  const url = bundle.info.get('SUFeedURL')

  return url !== undefined && existsSync(join(bundle.path, 'Contents/Frameworks/Sparkle.framework'))
    ? sparkleFeed(bundle, { url, channels: [] })
    : undefined
}
