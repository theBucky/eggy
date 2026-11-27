import { checked, exec } from '$platform/exec'
import type { OptimizeOutcome } from '$shared/optimize'

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

export async function runAsRoot<Key>(plans: Map<Key, Plan>): Promise<Map<Key, OptimizeOutcome>> {
  const shell = Array.from(
    plans.values(),
    ({ script }) => `(${script}) 2>&1; printf '${SEPARATOR}%d${SEPARATOR}' "$?"`
  ).join('\n')

  const names = plans.size === 1 ? 'an optimization' : `${plans.size} optimizations`
  const prompt = `eggy needs an administrator to run ${names}.`
  const source = `do shell script ${appleScriptString(shell)} with prompt ${appleScriptString(prompt)} with administrator privileges without altering line endings`

  const ran = await exec('/usr/bin/osascript', ['-e', source])

  const settle = (
    outcomeOf: (plan: Plan, index: number) => OptimizeOutcome
  ): Map<Key, OptimizeOutcome> =>
    new Map(Array.from(plans, ([key, plan], index) => [key, outcomeOf(plan, index)]))

  if (ran.exit !== 0 && ran.stderr.includes('(-128)')) {
    return settle(() => ({ status: 'skipped', message: 'Administrator access was not granted.' }))
  }

  const parts = checked(ran).split(SEPARATOR)

  return settle((plan, index) => {
    const printed = parts[2 * index]
    const code = parts[2 * index + 1]

    if (printed === undefined || code === undefined) {
      throw new Error("The administrator script didn't report every result.")
    }

    return plan.interpret({ code: Number(code), printed: printed.trim() })
  })
}
