import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app } from 'electron'
import * as z from 'zod'
import type {
  Package,
  PackageCheck,
  PackageKind,
  PackageList,
  PackageUpgrade
} from '$shared/packages'
import { errorCode, failure } from './errors'
import { checked, exec, type Options } from './exec'
import { loginEnv } from './login-env'

const env = loginEnv.then((env) => ({
  ...env,
  HOMEBREW_NO_AUTO_UPDATE: '1',
  HOMEBREW_NO_ENV_HINTS: '1',
  HOMEBREW_NO_EMOJI: '1'
}))

// brew prints its headlines to stderr as well, so a failure reads from the first error on.
function messageOf(stderr: string): string {
  const start = stderr.indexOf('Error: ')

  return (start === -1 ? stderr : stderr.slice(start + 'Error: '.length)).trim()
}

async function brew(
  args: string[],
  { env: extra, report }: Pick<Options, 'env' | 'report'> = {}
): Promise<string> {
  const ran = await exec('brew', args, { env: { ...(await env), ...extra }, report })
  const message = messageOf(ran.stderr)

  if (ran.exit !== 0 && message !== '') throw new Error(message)

  return checked(ran)
}

// brew skips pinned packages when upgrading, so a pinned package never counts as outdated.
function stateOf({ pinned, outdated }: { pinned: boolean; outdated: boolean }): Package['state'] {
  if (pinned) return 'pinned'

  return outdated ? 'outdated' : 'current'
}

const Formula = z
  .object({
    name: z.string(),
    full_name: z.string(),
    tap: z.string().nullable(),
    desc: z.string().nullable(),
    homepage: z.string().nullable(),
    versions: z.object({ stable: z.string().nullable() }),
    revision: z.number(),
    installed: z
      .array(z.object({ version: z.string(), installed_on_request: z.boolean() }))
      .nonempty(),
    linked_keg: z.string().nullable(),
    pinned: z.boolean(),
    outdated: z.boolean()
  })
  .transform((formula): Package => {
    const { stable } = formula.versions
    const version = formula.linked_keg ?? formula.installed[formula.installed.length - 1].version
    const revision = formula.revision > 0 ? `_${formula.revision}` : ''

    return {
      kind: 'formula',
      name: formula.name,
      fullName: formula.full_name,
      description: formula.desc ?? undefined,
      homepage: formula.homepage ?? undefined,
      tap: formula.tap ?? undefined,
      version,
      latest: stable === null ? version : stable + revision,
      requested: formula.installed.some((keg) => keg.installed_on_request),
      state: stateOf(formula)
    }
  })

const Cask = z
  .object({
    token: z.string(),
    full_token: z.string(),
    tap: z.string().nullable(),
    desc: z.string().nullable(),
    homepage: z.string().nullable(),
    version: z.string(),
    installed: z.string(),
    pinned: z.boolean().default(false),
    outdated: z.boolean()
  })
  .transform((cask): Package => ({
    kind: 'cask',
    name: cask.token,
    fullName: cask.full_token,
    description: cask.desc ?? undefined,
    homepage: cask.homepage ?? undefined,
    tap: cask.tap ?? undefined,
    version: cask.installed,
    latest: cask.version,
    requested: true,
    state: stateOf(cask)
  }))

const Info = z.object({ formulae: z.array(Formula), casks: z.array(Cask) })

async function installed(): Promise<Package[]> {
  const info = Info.safeParse(JSON.parse(await brew(['info', '--json=v2', '--installed'])))

  if (!info.success) throw new Error('brew described its packages in an unexpected shape.')

  const { formulae, casks } = info.data

  return [...formulae, ...casks].toSorted((a, b) => a.name.localeCompare(b.name))
}

async function read(): Promise<PackageList> {
  try {
    return { status: 'listed', packages: await installed() }
  } catch (cause) {
    return errorCode(cause) === 'ENOENT' ? { status: 'missing' } : failure(cause)
  }
}

let launchList: Promise<PackageList> | undefined = read()

export function list(): Promise<PackageList> {
  const listing = launchList ?? read()

  launchList = undefined

  return listing
}

export async function check(): Promise<PackageCheck> {
  try {
    await brew(['update'])

    return { status: 'checked', packages: await installed() }
  } catch (cause) {
    return failure(cause)
  }
}

// sudo has no terminal to prompt in, so casks that run an installer ask for the password in a dialog.
async function writeAskpass(): Promise<string> {
  const path = join(app.getPath('userData'), 'askpass')

  await writeFile(
    path,
    `#!/bin/sh
exec /usr/bin/osascript -e 'text returned of (display dialog "eggy needs an administrator password to upgrade a package." default answer "" with title "eggy" with hidden answer with icon caution)'
`,
    { mode: 0o700 }
  )

  return path
}

export async function upgrade(
  kind: PackageKind,
  fullName: string,
  report: (text: string) => void
): Promise<PackageUpgrade> {
  try {
    await brew(['upgrade', `--${kind}`, fullName], {
      env: { SUDO_ASKPASS: await writeAskpass() },
      report
    })

    return { status: 'upgraded' }
  } catch (cause) {
    return failure(cause)
  }
}
