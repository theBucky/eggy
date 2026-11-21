import type { Readable } from 'node:stream'

export function corrupt(): Error {
  return new Error('The delta is corrupt.')
}

export class Reader {
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
