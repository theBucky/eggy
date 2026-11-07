import * as z from 'zod'
import type { Bundle } from './bundle'
import { fetchFeed, verifyChecksum, verifySigner, type Feed, type Update } from './framework'

// Each level includes its payload only when its status is ok.
const Answer = z.looseObject({ status: z.string() })

const Reply = z.object({ response: z.object({ apps: z.tuple([Answer]) }) })

const Download = z.object({
  size: z.number().optional(),
  out: z.object({ sha256: z.string() }),
  urls: z.array(z.object({ url: z.string() }))
})

const Offer = z.object({
  nextversion: z.string(),
  pipelines: z.tuple([z.object({ operations: z.tuple([Download], z.unknown()) })], z.unknown())
})

const server = 'https://update.googleapis.com/service/update2/json'

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
  const reply = Reply.parse(JSON.parse((await response.text()).replace(/^\)\]\}'/, '')))
  const [app] = reply.response.apps

  if (app.status !== 'ok') throw new Error(`The update server answered ${app.status}.`)

  const { status } = Answer.parse(app.updatecheck)

  if (status === 'noupdate') return undefined

  if (status !== 'ok') throw new Error(`The update server answered ${status}.`)

  const { nextversion, pipelines } = Offer.parse(app.updatecheck)
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
      await verifyChecksum(archive, 'sha256', 'hex', download.out.sha256)
      await verifySigner(bundle.path, replacement)
    }
  }
}

export function googleUpdaterFeed(bundle: Bundle): Feed {
  return { url: server, check: () => check(bundle) }
}
