import { mkdir, readdir } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { output } from '../exec'
import { readBundle, type Bundle } from './bundle'
import { applyDelta } from './delta'

async function findBundle(dir: string, id: string): Promise<string> {
  for (const name of await readdir(dir)) {
    const path = join(dir, name)

    if (name.endsWith('.app') && (await readBundle(path)).id === id) return path
  }

  throw new Error(`The download holds no app with the identifier ${id}.`)
}

// ditto keeps the symlinks, extended attributes, and code signatures that an app bundle relies on.
export async function unpack(archive: string, work: string, bundle: Bundle): Promise<string> {
  const contents = join(work, 'contents')
  const type = extname(archive).toLowerCase()

  if (type === '.zip') {
    await output('/usr/bin/ditto', ['-x', '-k', archive, contents])

    return findBundle(contents, bundle.id)
  }

  if (type === '.delta') {
    const replacement = join(contents, basename(bundle.path))

    await applyDelta(bundle.path, archive, replacement)

    return replacement
  }

  if (type === '.dmg') {
    const mount = join(work, 'mount')

    // Like Sparkle, this accepts any license agreement the disk image asks about on stdin.
    await output(
      '/usr/bin/hdiutil',
      [
        'attach',
        archive,
        '-mountpoint',
        mount,
        '-readonly',
        '-noverify',
        '-nobrowse',
        '-noautoopen'
      ],
      { input: 'yes\n' }
    )

    try {
      const source = await findBundle(mount, bundle.id)
      const copy = join(contents, basename(source))

      await output('/usr/bin/ditto', [source, copy])

      return copy
    } finally {
      await output('/usr/bin/hdiutil', ['detach', mount, '-force'])
    }
  }

  // Google's updater wraps a disk image in a crx3, a zip behind a signed header that tar skips.
  if (type === '.crx3') {
    const wrapped = join(work, 'wrapped')

    await mkdir(wrapped)
    await output('/usr/bin/tar', ['-xf', archive, '-C', wrapped])

    const image = (await readdir(wrapped)).find((name) => extname(name) === '.dmg')

    if (image === undefined) throw new Error('The download holds no disk image.')

    return unpack(join(wrapped, image), work, bundle)
  }

  throw new Error(`Upgrades packaged as ${type || 'files without an extension'} aren't supported.`)
}
