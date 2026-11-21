import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Bundle } from '../bundle'
import { findItem, type Appcast, type Enclosure } from './appcast'
import { fetchFeed, type Feed, type Framework, type Update } from './feed'
import { verifyEdSignature, verifySigner } from './verify'

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
        : verifyEdSignature(archive, enclosure.signature, key)
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
