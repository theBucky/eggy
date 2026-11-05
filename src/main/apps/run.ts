import { execFile } from 'node:child_process'

export function run(file: string, args: string[], input = ''): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(file, args, { maxBuffer: Infinity }, (error, stdout, stderr) => {
      if (error) reject(new Error(stderr.trim() || error.message))
      else resolve(stdout)
    })

    child.stdin?.end(input)
  })
}
