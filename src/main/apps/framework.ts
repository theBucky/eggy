import { createHash, type BinaryToTextEncoding } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { net } from 'electron'
import type { Release } from '../../shared/api'
import type { Bundle } from './bundle'
import { run } from './run'

export type Update = {
  release: Release
  verify: (archive: string, replacement: string) => Promise<void>
}

export type Feed = {
  url: string
  check: () => Promise<Update[]>
}

export type Framework = (bundle: Bundle) => Promise<Feed | undefined>

export async function fetchFeed(url: string, init?: RequestInit): Promise<Response> {
  const response = await net.fetch(url, { headers: { accept: '*/*' }, ...init })

  if (!response.ok) throw new Error(`The update feed answered with HTTP ${response.status}.`)

  return response
}

export async function verifyChecksum(
  archive: string,
  algorithm: string,
  encoding: BinaryToTextEncoding,
  digest: string
): Promise<void> {
  const hash = createHash(algorithm)

  for await (const chunk of createReadStream(archive)) hash.update(chunk)

  if (hash.digest(encoding) !== digest) {
    throw new Error("The download doesn't match the update's checksum.")
  }
}

// Like Squirrel, this trusts a replacement only when its code signature meets the installed app's
// designated requirement.
export async function verifySigner(installed: string, replacement: string): Promise<void> {
  const requirement = (await run('codesign', ['-d', '-r-', installed])).replace(
    /^designated => /,
    ''
  )

  // Chrome ships Finder info on its files, which sits outside the signature, so the sideband check
  // stays off.
  try {
    await run('codesign', [
      '--verify',
      '--deep',
      '--strict=symlinks',
      `-R=${requirement}`,
      replacement
    ])
  } catch {
    throw new Error("The update isn't signed by the app's developer.")
  }
}
