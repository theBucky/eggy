import { fs } from '../fs'
import { corrupt, type Reader } from './reader'

// bsdiff stores numbers as sign and magnitude.
function offtin(buffer: Buffer, offset: number): number {
  const magnitude = Number(buffer.readBigUInt64LE(offset) & 0x7fff_ffff_ffff_ffffn)

  return buffer[offset + 7] & 0x80 ? -magnitude : magnitude
}

// Sparkle's BSDIFN40 variant of bsdiff leaves its blocks uncompressed, and the whole diff block
// comes before the extra block, so the patched file fills in place over two passes.
export async function bspatch(
  reader: Reader,
  length: number,
  source: string,
  path: string
): Promise<void> {
  const header = await reader.read(32)
  const controlLength = offtin(header, 8)
  const size = offtin(header, 24)

  // The diff and extra blocks together hold as many bytes as the patched file.
  if (header.toString('latin1', 0, 8) !== 'BSDIFN40' || 32 + controlLength + size !== length) {
    throw corrupt()
  }

  const control = await reader.read(controlLength)
  const steps: { at: number; add: number; copy: number; from: number }[] = []

  for (let offset = 0, at = 0, from = 0; at < size; offset += 24) {
    const add = offtin(control, offset)
    const copy = offtin(control, offset + 8)

    steps.push({ at, add, copy, from })
    at += add + copy
    from += add + offtin(control, offset + 16)
  }

  await using old = await fs.open(source)
  await using patched = await fs.open(path, 'wx')
  const { size: oldSize } = await old.stat()

  for (const { at, add, from } of steps) {
    let offset = 0

    for await (const piece of reader.take(add)) {
      // Diff bytes past either end of the old file stand for themselves.
      const position = from + offset
      const start = Math.max(position, 0)
      const end = Math.min(position + piece.length, oldSize)

      if (end > start) {
        const original = Buffer.alloc(end - start)

        await old.read(original, 0, original.length, start)

        for (let index = 0; index < original.length; index++) {
          piece[start - position + index] += original[index]
        }
      }

      await patched.write(piece, 0, piece.length, at + offset)
      offset += piece.length
    }
  }

  for (const { at, add, copy } of steps) {
    let offset = at + add

    for await (const piece of reader.take(copy)) {
      await patched.write(piece, 0, piece.length, offset)
      offset += piece.length
    }
  }
}
