import { basename, join } from 'node:path'
import { DOMParser, onErrorStopParsing } from '@xmldom/xmldom'
import { run } from './run'

export type Bundle = {
  path: string
  id: string
  name: string
  version: string
  build: string
  executable: string
  info: Map<string, string>
}

// xml preserves property list dates and data that json cannot represent.
async function readInfo(path: string): Promise<Map<string, string>> {
  const xml = await run('plutil', [
    '-convert',
    'xml1',
    '-o',
    '-',
    '--',
    join(path, 'Contents/Info.plist')
  ])

  const dict = new DOMParser({ onError: onErrorStopParsing })
    .parseFromString(xml, 'text/xml')
    .getElementsByTagName('dict')
    .item(0)

  // Each key element comes right before the element that holds its value.
  const fields = [...(dict?.children ?? [])]
  const strings = new Map<string, string>()

  for (let index = 0; index + 1 < fields.length; index += 2) {
    const value = fields[index + 1]

    if (value.tagName === 'string') {
      strings.set(fields[index].textContent ?? '', value.textContent ?? '')
    }
  }

  return strings
}

export async function readBundle(path: string): Promise<Bundle> {
  const info = await readInfo(path)
  const id = info.get('CFBundleIdentifier')
  const build = info.get('CFBundleVersion')
  const executable = info.get('CFBundleExecutable')

  if (id === undefined || build === undefined || executable === undefined) {
    throw new Error(`${basename(path)} names no identifier, version, or executable.`)
  }

  return {
    path,
    id,
    name: info.get('CFBundleDisplayName') ?? info.get('CFBundleName') ?? basename(path, '.app'),
    version: info.get('CFBundleShortVersionString') ?? build,
    build,
    executable: join(path, 'Contents/MacOS', executable),
    info
  }
}
