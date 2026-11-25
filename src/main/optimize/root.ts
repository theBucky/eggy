import type { OptimizeOutcome } from '$shared/optimize'
import { checked, exec } from '../exec'

type Exit = { code: number; printed: string }

export type Plan = { script: string; interpret: (exit: Exit) => OptimizeOutcome }

export type Prepared = OptimizeOutcome | Plan

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

export async function runAsRoot(plans: Plan[]): Promise<OptimizeOutcome[]> {
  const shell = plans
    .map(({ script }) => `(${script}) 2>&1; printf '${SEPARATOR}%d${SEPARATOR}' "$?"`)
    .join('\n')

  const names = plans.length === 1 ? 'an optimization' : `${plans.length} optimizations`
  const prompt = `eggy needs an administrator to run ${names}.`
  const source = `do shell script ${appleScriptString(shell)} with prompt ${appleScriptString(prompt)} with administrator privileges without altering line endings`

  const ran = await exec('/usr/bin/osascript', ['-e', source])

  // -128 is AppleScript's "User canceled."
  if (ran.exit !== 0 && ran.stderr.includes('(-128)')) {
    return plans.map(() => ({
      status: 'skipped',
      message: 'Administrator access was not granted.'
    }))
  }

  const parts = checked(ran).split(SEPARATOR)

  return plans.map((plan, index) =>
    plan.interpret({ code: Number(parts[2 * index + 1]), printed: parts[2 * index].trim() })
  )
}
