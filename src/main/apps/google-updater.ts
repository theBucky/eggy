import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import type { Bundle } from './bundle'
import { verifySigner } from './codesign'
import { fetchFeed, type Feed, type Update } from './framework'

type Download = {
  size: number
  out: { sha256: string }
  urls: { url: string }[]
}

type UpdateCheck = {
  status: string
  nextversion: string
  pipelines: { operations: [Download, ...unknown[]] }[]
}

type Reply = {
  response: { apps: [{ status: string; updatecheck: UpdateCheck }] }
}

const server = 'https://update.googleapis.com/service/update2/json'

async function verifyChecksum(archive: string, sha256: string): Promise<void> {
  const hash = createHash('sha256')

  for await (const chunk of createReadStream(archive)) hash.update(chunk)

  if (hash.digest('hex') !== sha256) {
    throw new Error("The download doesn't match the update's checksum.")
  }
}

async function check(bundle: Bundle): Promise<Update | undefined> {
  const response = await fetchFeed(server, {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({
      request: {
        protocol: '4.0',
        // The server offers no package to an updater that can't run an installer.
        acceptformat: 'crx3,download,run',
        os: { platform: 'Mac OS X', version: process.getSystemVersion(), arch: process.arch },
        arch: process.arch,
        apps: [
          {
            appid: bundle.info.get('KSProductID'),
            version: bundle.version,
            ap: bundle.info.get('KSChannelID'),
            // Like Chrome's About page, this asks on demand, which the server doesn't throttle.
            installsource: 'ondemand',
            updatecheck: {}
          }
        ]
      }
    })
  })

  // Google prefixes its JSON so that it can't run as a script.
  const reply: Reply = JSON.parse((await response.text()).replace(/^\)\]\}'/, ''))
  const [app] = reply.response.apps

  if (app.status !== 'ok') throw new Error(`The update server answered ${app.status}.`)

  const { status, nextversion, pipelines } = app.updatecheck

  if (status === 'noupdate') return undefined

  if (status !== 'ok') throw new Error(`The update server answered ${status}.`)

  const [download] = pipelines[0].operations
  const url = download.urls.find((candidate) => candidate.url.startsWith('https:'))?.url

  if (url === undefined) throw new Error('The update offers no secure download.')

  return {
    release: {
      version: nextversion,
      build: nextversion,
      date: undefined,
      url,
      size: download.size,
      notes: undefined
    },
    verify: async (archive, replacement) => {
      await verifyChecksum(archive, download.out.sha256)
      await verifySigner(bundle.path, replacement)
    }
  }
}

export function googleUpdaterFeed(bundle: Bundle): Feed {
  return { url: server, check: () => check(bundle) }
}
