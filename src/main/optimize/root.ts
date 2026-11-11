import type { OptimizeOutcome } from '$shared/api'
import { checked, exec } from '../exec'

export type Exit = { code: number; printed: string }

export type Plan = { script: string; interpret: (exit: Exit) => OptimizeOutcome }

export type Prepared = OptimizeOutcome | Plan

// A condition that must still hold when a script runs, which can be long after planning while the
// password prompt waits. Its check exits with 0 to go ahead, 1 to stop, and anything else after
// printing why it can't tell.
export type Guard = { check: string; stopped: OptimizeOutcome }

export const EXIT = { refused: 75, stopped: 76, unsure: 77 } as const

export async function guarded(guard: Guard, task: () => Promise<Prepared>): Promise<Prepared> {
  const ran = await exec('/bin/sh', ['-c', guard.check], { timeout: 10_000 })

  if (ran.exit === 1) return guard.stopped

  if (ran.exit !== 0) throw new Error((ran.stdout + ran.stderr).trim() || 'A safety check failed.')

  const plan = await task()

  if (!('script' in plan)) return plan

  return {
    script: `(${guard.check}) || case $? in 1) exit ${EXIT.stopped} ;; *) exit ${EXIT.unsure} ;; esac
${plan.script}`,
    interpret: (exit) => {
      if (exit.code === EXIT.stopped) return guard.stopped

      if (exit.code === EXIT.unsure) {
        return { status: 'failed', message: exit.printed || 'A safety check failed.' }
      }

      return plan.interpret(exit)
    }
  }
}

// Separates one script's output from the next. Nothing these scripts print contains it.
const SEPARATOR = '\x1e'

export function quote(argument: string): string {
  return `'${argument.replaceAll("'", `'\\''`)}'`
}

export function command(...argv: string[]): string {
  return argv.map(quote).join(' ')
}

function appleScriptString(text: string): string {
  return `"${text.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}

// Runs every script in one shell as root, so macOS asks for the administrator password once. Each
// script's output and exit status come back in order, or `undefined` when the user cancels.
export async function runAsRoot(scripts: string[], prompt: string): Promise<Exit[] | undefined> {
  const shell = scripts
    .map((script) => `(${script}) 2>&1; printf '${SEPARATOR}%d${SEPARATOR}' "$?"`)
    .join('\n')

  const source = `do shell script ${appleScriptString(shell)} with prompt ${appleScriptString(prompt)} with administrator privileges without altering line endings`

  const ran = await exec('/usr/bin/osascript', ['-e', source])

  // -128 is AppleScript's "User canceled."
  if (ran.exit !== 0 && ran.stderr.includes('(-128)')) return undefined

  return parse(checked(ran))
}

function parse(stdout: string): Exit[] {
  const parts = stdout.split(SEPARATOR)
  const exits: Exit[] = []

  for (let index = 0; index + 1 < parts.length; index += 2) {
    exits.push({ code: Number(parts[index + 1]), printed: parts[index].trim() })
  }

  return exits
}
