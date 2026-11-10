import { createPublicKey, verify } from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { findItem, type Appcast, type Enclosure } from './appcast'
import type { Bundle } from './bundle'
import { fetchFeed, verifySigner, type Feed, type Framework, type Update } from './framework'

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

export function readAppcast(bundle: Bundle, xml: string, appcast: Appcast): Update[] {
  const item = findItem(xml, appcast, bundle.build)

  if (item === undefined) return []

  const key = bundle.info.get('SUPublicEDKey')

  const updateOf = (enclosure: Enclosure): Update => ({
    release: { ...item.release, url: enclosure.url, size: enclosure.size },
    // Like Sparkle, an app without an EdDSA key trusts an update by its code signature instead.
    verify: (archive, replacement) =>
      key === undefined
        ? verifySigner(bundle.path, replacement)
        : verifySignature(archive, enclosure.signature, key)
  })

  return (item.delta ? [item.delta, item.archive] : [item.archive]).map(updateOf)
}

export function sparkleFeed(bundle: Bundle, appcast: Appcast): Feed {
  return {
    url: appcast.url,
    check: async () => readAppcast(bundle, await (await fetchFeed(appcast.url)).text(), appcast)
  }
}

export const sparkle: Framework = async (bundle) => {
  const url = bundle.info.get('SUFeedURL')

  return url !== undefined && existsSync(join(bundle.path, 'Contents/Frameworks/Sparkle.framework'))
    ? sparkleFeed(bundle, { url, channels: [] })
    : undefined
}
