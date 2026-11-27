import { homedir } from 'node:os'
import { basename, join } from 'node:path'
import { shell } from 'electron'
import { list, plural } from '$shared/english'
import type { OptimizeOutcome, Review } from '$shared/optimize'
import { exec, output } from '../exec'
import { entries, exists } from './support'

const LOGIN_ITEMS = `tell application "System Events"
  set listing to ""
  repeat with loginItem in login items
    set listing to listing & (name of loginItem) & tab & (path of loginItem) & linefeed
  end repeat
end tell
return listing`

// An app that moved still opens at login, so Spotlight looks for it by name before it counts as gone.
async function findable(name: string): Promise<boolean> {
  if (name.includes("'") || name.includes('\\')) return true

  const found = await output('/usr/bin/mdfind', [`kMDItemFSName == '${name}.app'`], {
    timeout: 5000
  })

  return found.trim() !== ''
}

export async function loginItems(): Promise<OptimizeOutcome> {
  // The first run waits on the user to answer macOS's prompt to let eggy control System Events.
  const ran = await exec('/usr/bin/osascript', ['-e', LOGIN_ITEMS], { timeout: 120_000 })

  if (ran.stderr.includes('(-1743)')) {
    return {
      status: 'skipped',
      message: 'Needs permission to control System Events, under Automation in System Settings.'
    }
  }

  if (ran.exit === 'timeout') {
    throw new Error("System Events didn't list login items within two minutes.")
  }

  if (ran.exit !== 0) throw new Error(ran.stderr.trim() || "Couldn't list login items.")

  const items = ran.stdout.split('\n').flatMap((line) => {
    const [name, path] = line.split('\t')

    return path === undefined ? [] : [{ name, path }]
  })

  if (items.length === 0) return { status: 'unchanged', message: 'No login items.' }

  const gone: string[] = []

  for (const { name, path } of items) {
    if (!(await exists(path)) && !(await findable(name))) gone.push(name)
  }

  if (gone.length === 0) {
    return {
      status: 'unchanged',
      message: `All ${plural(items.length, 'login item', 'login items')} open existing apps.`
    }
  }

  return {
    status: 'attention',
    message:
      gone.length === 1
        ? `${gone[0]} opens at login, but its app is gone.`
        : `${list.format(gone)} open at login, but their apps are gone.`,
    review: 'loginItems'
  }
}

const LAUNCH_AGENTS = join(homedir(), 'Library/LaunchAgents')

async function programOf(plist: string): Promise<string | undefined> {
  for (const key of ['Program', 'ProgramArguments.0']) {
    const ran = await exec('/usr/bin/plutil', ['-extract', key, 'raw', '-o', '-', plist], {
      timeout: 5000
    })

    if (ran.exit === 0 && ran.stdout.trim() !== '') return ran.stdout.trim()
  }

  return undefined
}

async function missing(program: string): Promise<boolean> {
  const volume = /^\/Volumes\/[^/]+/.exec(program)?.[0]

  if (volume !== undefined && !(await exists(volume))) return false

  return !(await exists(program))
}

export async function launchAgents(): Promise<OptimizeOutcome> {
  const plists = (await entries(LAUNCH_AGENTS)).filter((name) => name.endsWith('.plist'))

  if (plists.length === 0) return { status: 'unchanged', message: 'No launch agents.' }

  const gone: string[] = []

  for (const name of plists) {
    const program = await programOf(join(LAUNCH_AGENTS, name))

    if (program?.startsWith('/') && (await missing(program))) {
      gone.push(basename(name, '.plist'))
    }
  }

  if (gone.length === 0) {
    return { status: 'unchanged', message: "Every launch agent's program exists." }
  }

  return {
    status: 'attention',
    message:
      gone.length === 1
        ? `${gone[0]} runs a program that is gone.`
        : `${plural(gone.length, 'launch agent runs', 'launch agents run')} programs that are gone.`,
    review: 'launchAgents'
  }
}

export async function review(target: Review): Promise<void> {
  if (target === 'loginItems') {
    await shell.openExternal('x-apple.systempreferences:com.apple.LoginItems-Settings.extension')
  } else {
    await shell.openPath(LAUNCH_AGENTS)
  }
}
