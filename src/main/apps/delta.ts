import { spawn, type ChildProcess } from 'node:child_process'
import { createHash } from 'node:crypto'
import { once } from 'node:events'
import { join } from 'node:path'
import type { Readable } from 'node:stream'
import { crc32 } from 'node:zlib'
// Electron's fs reads an asar archive as a folder, which would hash and patch an app wrongly.
import { constants, createReadStream, promises as fs, type Stats } from 'original-fs'
import { run } from './run'

type Item = {
  path: string
  commands: number
  mode: number
  length: number
  clone: string | undefined
}

type Sum = {
  update: (data: Uint8Array) => void
  digest: () => Buffer
}

const Command = { delete: 1, extract: 2, permissions: 4, diff: 8, clone: 16 } as const

// Sparkle compresses a delta with Apple's compression library, whose command line tool decodes it.
const algorithms = new Map([
  [2, 'lzma'],
  [3, 'lzfse'],
  [4, 'lz4'],
  [5, 'zlib']
])

const fts = { directory: 1, file: 8, link: 12 } as const

const permissionBits = 0o7777

function corrupt(): Error {
  return new Error('The delta is corrupt.')
}

class Reader {
  #chunks: AsyncIterator<Buffer>
  #rest: Buffer = Buffer.alloc(0)

  constructor(stream: Readable) {
    this.#chunks = stream[Symbol.asyncIterator]()
  }

  async *take(length: number): AsyncGenerator<Buffer> {
    for (let left = length; left > 0;) {
      if (this.#rest.length === 0) {
        const { done, value } = await this.#chunks.next()

        if (done) throw corrupt()

        this.#rest = value
      }

      const piece = this.#rest.subarray(0, left)

      this.#rest = this.#rest.subarray(piece.length)
      left -= piece.length

      yield piece
    }
  }

  async read(length: number): Promise<Buffer> {
    const buffer = Buffer.alloc(length)
    let offset = 0

    for await (const piece of this.take(length)) {
      buffer.set(piece, offset)
      offset += piece.length
    }

    return buffer
  }

  async uint(bytes: 1 | 2 | 4 | 8): Promise<number> {
    const buffer = await this.read(bytes)

    return bytes === 8 ? Number(buffer.readBigUInt64LE()) : buffer.readUIntLE(0, bytes)
  }
}

function uint(value: number, bytes: 2 | 8): Buffer {
  const buffer = Buffer.alloc(bytes)

  if (bytes === 8) buffer.writeBigUInt64LE(BigInt(value))
  else buffer.writeUInt16LE(value)

  return buffer
}

function crcSum(): Sum {
  let value = 0

  return {
    update: (data) => {
      value = crc32(data, value)
    },
    digest: () => uint(value, 8)
  }
}

function typeOf(stats: Stats): number | undefined {
  if (stats.isDirectory()) return fts.directory

  if (stats.isFile()) return fts.file

  return stats.isSymbolicLink() ? fts.link : undefined
}

// Like fts, this visits a folder before its contents, sorted by the bytes of their names.
async function* walk(root: string, relative = ''): AsyncGenerator<[string, Stats]> {
  const names = await fs.readdir(join(root, relative), { encoding: 'buffer' })

  for (const name of names.sort(Buffer.compare)) {
    const path = `${relative}/${name}`
    const stats = await fs.lstat(join(root, path))

    yield [path, stats]

    if (stats.isDirectory()) yield* walk(root, path)
  }
}

// Version 4 sums the tree with crc32 where earlier versions use sha1.
async function hashTree(root: string, version: number): Promise<Buffer> {
  const sum = (): Sum => (version >= 4 ? crcSum() : createHash('sha1'))
  const tree = sum()

  for await (const [relative, stats] of walk(root)) {
    const type = typeOf(stats)

    // Sparkle leaves out a custom folder icon.
    if (type === undefined || relative === '/Icon\r') continue

    const path = join(root, relative)

    if (type !== fts.directory) {
      const contents = sum()

      if (type === fts.link) {
        contents.update(await fs.readlink(path, { encoding: 'buffer' }))
      } else {
        if (version >= 4) contents.update(uint(stats.size, 8))

        for await (const chunk of createReadStream(path, { highWaterMark: 1 << 20 })) {
          contents.update(chunk)
        }
      }

      tree.update(contents.digest())
    } else if (version < 4) {
      tree.update(Buffer.alloc(20, 0xdd))
    }

    // Sparkle hashes paths in their decomposed file system form, and links as always 0755.
    tree.update(Buffer.from(relative.normalize('NFD')))
    tree.update(uint(type, 2))
    tree.update(uint(type === fts.link ? 0o755 : stats.mode & permissionBits, 2))
  }

  return Buffer.concat([tree.digest()], 20)
}

// bsdiff stores numbers as sign and magnitude.
function offtin(buffer: Buffer, offset: number): number {
  const magnitude = Number(buffer.readBigUInt64LE(offset) & 0x7fff_ffff_ffff_ffffn)

  return buffer[offset + 7] & 0x80 ? -magnitude : magnitude
}

// Sparkle's BSDIFN40 variant of bsdiff leaves its blocks uncompressed, and the whole diff block
// comes before the extra block, so the patched file fills in place over two passes.
async function bspatch(
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

function remove(path: string): Promise<void> {
  return fs.rm(path, { recursive: true, force: true })
}

// Like Sparkle, this keeps an item from writing through a link that an earlier item placed.
async function target(root: string, relative: string): Promise<string> {
  let folder = root

  for (const name of relative.split('/').slice(1, -1)) {
    folder = join(folder, name)

    const stats = await fs.lstat(folder).catch(() => undefined)

    if (stats === undefined) break

    if (stats.isSymbolicLink()) throw new Error(`The delta writes through a link at ${relative}.`)
  }

  return join(root, relative)
}

async function readItems(reader: Reader): Promise<Item[]> {
  const paths = (await reader.read(await reader.uint(8))).toString().split('\0').slice(0, -1)

  if (paths.some((path) => path.split('/').includes('..'))) {
    throw new Error('The delta reaches outside the app.')
  }

  const items: Item[] = []

  // An empty path table ends the delta without any commands.
  while (paths.length > 0) {
    const commands = await reader.uint(1)

    if (commands === 0) break

    if (items.length === paths.length) throw corrupt()

    const item: Item = { path: paths[items.length], commands, mode: 0, length: 0, clone: undefined }

    if (commands & (Command.clone | Command.diff)) {
      if (commands & Command.permissions) item.mode = await reader.uint(2)

      if (commands & Command.clone) {
        const index = await reader.uint(4)

        if (index >= paths.length) throw corrupt()

        item.clone = paths[index]
      }

      if (commands & Command.diff) item.length = await reader.uint(8)
    } else if (commands & Command.extract) {
      item.mode = await reader.uint(2)

      const type = item.mode & constants.S_IFMT

      if (type === constants.S_IFREG) item.length = await reader.uint(8)
      else if (type === constants.S_IFLNK) item.length = await reader.uint(2)
    } else if (commands & Command.permissions) {
      item.mode = await reader.uint(2)
    }

    items.push(item)
  }

  return items
}

async function extract(reader: Reader, { mode, length }: Item, path: string): Promise<void> {
  const type = mode & constants.S_IFMT

  if (type === constants.S_IFLNK) {
    const link = await reader.read(length)

    await remove(path)
    await fs.symlink(link, path)
  } else if (type === constants.S_IFDIR) {
    await fs.mkdir(path)
    await fs.chmod(path, mode & permissionBits)
  } else if (type === constants.S_IFREG) {
    await remove(path)

    const file = await fs.open(path, 'wx')

    try {
      for await (const piece of reader.take(length)) await file.write(piece)
    } finally {
      await file.close()
    }

    await fs.chmod(path, mode & permissionBits)
  }
}

async function applyItem(
  reader: Reader,
  item: Item,
  installed: string,
  destination: string
): Promise<void> {
  const { commands } = item
  const path = await target(destination, item.path)
  const source = join(installed, item.clone ?? item.path)

  if (commands & Command.delete) await remove(path)

  if (commands & Command.diff) {
    await remove(path)
    await bspatch(reader, item.length, source, path)
    await fs.chmod(path, (await fs.lstat(source)).mode & permissionBits)
  } else if (commands & Command.clone) {
    await remove(path)
    await fs.copyFile(source, path, constants.COPYFILE_FICLONE)
  } else if (commands & Command.extract) {
    await extract(reader, item, path)
  }

  if (commands & Command.permissions && !(await fs.lstat(path)).isSymbolicLink()) {
    await fs.chmod(path, item.mode & permissionBits)
  }
}

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

  await run('ditto', [installed, destination])

  for (const item of await readItems(reader)) {
    await applyItem(reader, item, installed, destination)
  }

  if (!after.equals(await hashTree(destination, version))) {
    throw new Error("The patched app doesn't match the release.")
  }
}

// The decoder reads the delta past its header from the file offset it shares with this process.
async function decode(delta: string): Promise<ChildProcess> {
  const file = await fs.open(delta)

  try {
    const header = Buffer.alloc(6)

    await file.read(header, 0, header.length, null)

    // Older deltas are xar archives.
    if (header.toString('latin1', 0, 4) !== 'spk!') {
      throw new Error("The delta's format isn't supported.")
    }

    const algorithm = algorithms.get(header[4])

    if (algorithm === undefined) throw new Error("The delta's compression isn't supported.")

    const decoder = spawn('compression_tool', ['-decode', '-a', algorithm], {
      stdio: [file.fd, 'pipe', 'ignore']
    })

    await once(decoder, 'spawn')

    return decoder
  } finally {
    await file.close()
  }
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
