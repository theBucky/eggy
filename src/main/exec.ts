import { execFile } from 'node:child_process'
import * as z from 'zod'

type Options = { cwd?: string; env?: NodeJS.ProcessEnv; timeout?: number; input?: string }

// `exit` holds Node's error when the command never started or a signal stopped it.
type Ran = {
  file: string
  timeout: number
  exit: number | 'timeout' | Error
  stdout: string
  stderr: string
}

const Status = z.object({ code: z.number() })

// Output is unbounded, since hitting the default 1 MB cap kills a command midway, as it would a
// large pull that prints a diffstat line per file while updating the working tree.
export function exec(
  file: string,
  args: string[],
  { input, timeout = 0, ...options }: Options = {}
): Promise<Ran> {
  return new Promise((resolve) => {
    const child = execFile(
      file,
      args,
      { ...options, timeout, maxBuffer: Infinity },
      (error, stdout, stderr) => {
        const exit =
          error === null
            ? 0
            : error.killed
              ? 'timeout'
              : (Status.safeParse(error).data?.code ?? error)

        resolve({ file, timeout, exit, stdout, stderr })
      }
    )

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
