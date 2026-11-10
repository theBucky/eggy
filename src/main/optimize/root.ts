import { execFile } from 'node:child_process'
import type { OptimizeOutcome } from '$shared/api'
import { exec } from './support'

export type Exit = { code: number; output: string }

export type Plan = { script: string; interpret: (exit: Exit) => OptimizeOutcome }

// A condition that must still hold when a script runs, which can be long after planning while the
// password prompt waits. Its check exits with 0 to go ahead, 1 to stop, and anything else after
// printing why it can't tell.
export type Guard = { check: string; stopped: OptimizeOutcome }

const STOPPED = 76
const UNSURE = 77

export async function stoppedBy(guard: Guard): Promise<OptimizeOutcome | undefined> {
  const ran = await exec('/bin/sh', ['-c', guard.check], 10_000)

  if (ran.code === 0) return undefined

  if (ran.code === 1) return guard.stopped

  throw new Error((ran.stdout + ran.stderr).trim() || 'A safety check failed.')
}

export function guarded(guard: Guard, plan: Plan): Plan {
  return {
    script: `(${guard.check}) || case $? in 1) exit ${STOPPED} ;; *) exit ${UNSURE} ;; esac
${plan.script}`,
    interpret: (exit) => {
      if (exit.code === STOPPED) return guard.stopped

      if (exit.code === UNSURE) {
        return { status: 'failed', message: exit.output || 'A safety check failed.' }
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
export function runAsRoot(scripts: string[], prompt: string): Promise<Exit[] | undefined> {
  const shell = scripts
    .map((script) => `(${script}) 2>&1; printf '${SEPARATOR}%d${SEPARATOR}' "$?"`)
    .join('\n')

  const source = `do shell script ${appleScriptString(shell)} with prompt ${appleScriptString(prompt)} with administrator privileges without altering line endings`

  return new Promise((resolve, reject) => {
    execFile(
      '/usr/bin/osascript',
      ['-e', source],
      { maxBuffer: Infinity },
      (error, stdout, stderr) => {
        // -128 is AppleScript's "User canceled."
        if (error !== null && stderr.includes('(-128)')) resolve(undefined)
        else if (error !== null) reject(new Error(stderr.trim() || error.message))
        else resolve(parse(stdout))
      }
    )
  })
}

function parse(stdout: string): Exit[] {
  const parts = stdout.split(SEPARATOR)
  const exits: Exit[] = []

  for (let index = 0; index + 1 < parts.length; index += 2) {
    exits.push({ code: Number(parts[index + 1]), output: parts[index].trim() })
  }

  return exits
}
