import { join } from 'node:path'
import { constants, fs } from '../fs'
import { bspatch } from './bspatch'
import { corrupt, type Reader } from './reader'

type Item = {
  path: string
  commands: number
  mode: number
  length: number
  clone: string | undefined
}

const Command = { delete: 1, extract: 2, permissions: 4, diff: 8, clone: 16 } as const

function remove(path: string): Promise<void> {
  return fs.rm(path, { recursive: true, force: true })
}

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
    await fs.chmod(path, mode & 0o7777)
  } else if (type === constants.S_IFREG) {
    await remove(path)

    await using file = await fs.open(path, 'wx')

    for await (const piece of reader.take(length)) await file.write(piece)

    await fs.chmod(path, mode & 0o7777)
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
    await fs.chmod(path, (await fs.lstat(source)).mode & 0o7777)
  } else if (commands & Command.clone) {
    await remove(path)
    await fs.copyFile(source, path, constants.COPYFILE_FICLONE)
  } else if (commands & Command.extract) {
    await extract(reader, item, path)
  }

  if (commands & Command.permissions && !(await fs.lstat(path)).isSymbolicLink()) {
    await fs.chmod(path, item.mode & 0o7777)
  }
}

export async function applyItems(
  reader: Reader,
  installed: string,
  destination: string
): Promise<void> {
  for (const item of await readItems(reader)) {
    await applyItem(reader, item, installed, destination)
  }
}
