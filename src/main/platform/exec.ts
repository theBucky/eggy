import { execFile, type ExecFileException } from 'node:child_process'
import * as z from 'zod'

export type Options = {
  cwd?: string
  env?: NodeJS.ProcessEnv
  timeout?: number
  input?: string
  report?: (text: string) => void
}

type Exit = number | 'timeout' | Error

type Ran = {
  file: string
  timeout: number
  exit: Exit
  stdout: string
  stderr: string
}

const ExitCode = z.object({ code: z.number() })

function exitOf(error: ExecFileException | null): Exit {
  if (error === null) return 0

  if (error.killed) return 'timeout'

  return ExitCode.safeParse(error).data?.code ?? error
}

// Output is unbounded, since hitting the default 1 MB cap kills a command midway, as it would a
// large pull that prints a diffstat line per file while updating the working tree.
export function exec(
  file: string,
  args: string[],
  { input, report, timeout = 0, ...options }: Options = {}
): Promise<Ran> {
  return new Promise((resolve) => {
    const child = execFile(
      file,
      args,
      { ...options, timeout, maxBuffer: Infinity },
      (error, stdout, stderr) => resolve({ file, timeout, exit: exitOf(error), stdout, stderr })
    )

    if (report !== undefined) {
      child.stdout?.on('data', report)
      child.stderr?.on('data', report)
    }

    child.stdin?.end(input)
  })
}

export function checked({ file, timeout, exit, stdout, stderr }: Ran): string {
  if (exit === 0) return stdout

  if (exit === 'timeout') throw new Error(`${file} took longer than ${timeout / 1000} seconds.`)

  throw exit instanceof Error ? exit : new Error(stderr.trim() || `${file} exited with ${exit}.`)
}

export async function output(file: string, args: string[], options?: Options): Promise<string> {
  return checked(await exec(file, args, options))
}
