import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { crc32 } from 'node:zlib'
import { createReadStream, fs, type Stats } from '../fs'

type Sum = {
  update: (data: Uint8Array) => void
  digest: () => Buffer
}

const fts = { directory: 1, file: 8, link: 12 } as const

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

async function* walk(root: string, relative = ''): AsyncGenerator<[string, Stats]> {
  const names = await fs.readdir(join(root, relative), { encoding: 'buffer' })

  for (const name of names.sort((a, b) => a.compare(b))) {
    const path = `${relative}/${name.toString()}`
    const stats = await fs.lstat(join(root, path))

    yield [path, stats]

    if (stats.isDirectory()) yield* walk(root, path)
  }
}

export async function hashTree(root: string, version: number): Promise<Buffer> {
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

    tree.update(Buffer.from(relative.normalize('NFD')))
    tree.update(uint(type, 2))
    tree.update(uint(type === fts.link ? 0o755 : stats.mode & 0o7777, 2))
  }

  return Buffer.concat([tree.digest()], 20)
}
