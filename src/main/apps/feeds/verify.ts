import { createHash, createPublicKey, verify, type BinaryToTextEncoding } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { output } from '../../exec'

const verifyAsync = promisify(verify)

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

export async function verifyEdSignature(
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

export async function verifySigner(installed: string, replacement: string): Promise<void> {
  const requirement = (await output('/usr/bin/codesign', ['-d', '-r-', installed])).replace(
    /^designated => /,
    ''
  )

  // Chrome ships Finder info on its files, which sits outside the signature, so the sideband check
  // stays off.
  try {
    await output('/usr/bin/codesign', [
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
