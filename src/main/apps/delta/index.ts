import { spawn, type ChildProcess } from 'node:child_process'
import { once } from 'node:events'
import { output } from '$platform/exec'
import { fs } from '../fs'
import { applyItems } from './items'
import { Reader } from './reader'
import { hashTree } from './tree'

const algorithms = new Map([
  [2, 'lzma'],
  [3, 'lzfse'],
  [4, 'lz4'],
  [5, 'zlib']
])

async function patch(reader: Reader, installed: string, destination: string): Promise<void> {
  const version = await reader.uint(2)

  // Minor versions only change how a delta is made.
  await reader.uint(2)

  const before = await reader.read(20)
  const after = await reader.read(20)

  if (version !== 3 && version !== 4) {
    throw new Error(`Sparkle deltas of version ${version} aren't supported.`)
  }

  // Version 4 adds the app's creation date, which only Finder shows.
  if (version >= 4) await reader.read(8)

  if (!before.equals(await hashTree(installed, version))) {
    throw new Error("The delta doesn't patch the installed build.")
  }

  await output('/usr/bin/ditto', [installed, destination])
  await applyItems(reader, installed, destination)

  if (!after.equals(await hashTree(destination, version))) {
    throw new Error("The patched app doesn't match the release.")
  }
}

// The decoder reads the delta past its header from the file offset it shares with this process.
async function decode(delta: string): Promise<ChildProcess> {
  await using file = await fs.open(delta)
  const header = Buffer.alloc(6)

  await file.read(header, 0, header.length, null)

  if (header.toString('latin1', 0, 4) !== 'spk!') {
    throw new Error("The delta's format isn't supported.")
  }

  const algorithm = algorithms.get(header.readUInt8(4))

  if (algorithm === undefined) throw new Error("The delta's compression isn't supported.")

  const decoder = spawn('/usr/bin/compression_tool', ['-decode', '-a', algorithm], {
    stdio: [file.fd, 'pipe', 'ignore']
  })

  await once(decoder, 'spawn')

  return decoder
}

export async function applyDelta(
  installed: string,
  delta: string,
  destination: string
): Promise<void> {
  const decoder = await decode(delta)

  try {
    await patch(new Reader(decoder.stdout!), installed, destination)
  } finally {
    decoder.kill()
  }
}
