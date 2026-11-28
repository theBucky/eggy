import * as z from 'zod'
import type { Bundle } from '../bundle'
import { fetchFeed, type Feed, type Update } from './feed'
import { verifyChecksum, verifySigner } from './verify'
import { compare } from './version'

const Asset = z.object({
  name: z.string(),
  size: z.number(),
  browser_download_url: z.string(),
  // GitHub publishes digests only for assets uploaded since mid-2025.
  digest: z
    .string()
    .startsWith('sha256:')
    .transform((digest) => digest.slice('sha256:'.length))
    .nullable()
})

const Release = z.object({
  tag_name: z.string(),
  prerelease: z.boolean(),
  published_at: z.iso.datetime().transform((text) => Date.parse(text)),
  body: z.string().nullable(),
  assets: z.array(Asset)
})

type Source = {
  repo: string
  asset: RegExp
}

async function check(bundle: Bundle, { repo, asset }: Source): Promise<Update[]> {
  const response = await fetchFeed(`https://api.github.com/repos/${repo}/releases`)

  const offers = z
    .array(Release)
    .parse(await response.json())
    .flatMap((release) => {
      const file = release.assets.find((candidate) => asset.test(candidate.name))

      return file === undefined || release.prerelease ? [] : [{ release, file }]
    })

  const newest = offers.toSorted((a, b) => compare(b.release.tag_name, a.release.tag_name)).at(0)

  if (newest === undefined || compare(newest.release.tag_name, bundle.version) <= 0) return []

  const { release, file } = newest

  return [
    {
      release: {
        version: release.tag_name,
        build: release.tag_name,
        date: release.published_at,
        url: file.browser_download_url,
        size: file.size,
        notes: release.body ? { format: 'markdown', text: release.body } : undefined
      },
      verify: async (archive, replacement) => {
        if (file.digest !== null) await verifyChecksum(archive, 'sha256', 'hex', file.digest)

        await verifySigner(bundle.path, replacement)
      }
    }
  ]
}

export function githubReleasesFeed(bundle: Bundle, source: Source): Feed {
  return { url: `https://github.com/${source.repo}/releases`, check: () => check(bundle, source) }
}
