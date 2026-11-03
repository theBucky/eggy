import { execFile, spawnSync } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Failure, FetchOutcome, PullOutcome, Repo, Result, Sync } from '../shared/api'

type GitResult = {
  ok: boolean
  stdout: string
  stderr: string
}

// Finder starts the app with launchd's minimal PATH, which hides Homebrew tools that git runs by
// name, such as git-lfs and credential helpers. A login shell reports the PATH the user expects.
const shell = process.env.SHELL ?? '/bin/zsh'
const { stdout: loginPath } = spawnSync(shell, ['-lc', 'printf %s "$PATH"'], { encoding: 'utf8' })

// A repo that needs credentials should fail fast instead of waiting on a prompt nobody sees.
const env = { ...process.env, PATH: loginPath || process.env.PATH, GIT_TERMINAL_PROMPT: '0' }

function git(cwd: string, args: string[]): Promise<GitResult> {
  return new Promise((resolve) => {
    // A large pull prints a diffstat line per file, and hitting the default 1 MB cap kills git
    // midway through updating the working tree.
    execFile('git', args, { cwd, env, maxBuffer: Infinity }, (error, stdout, stderr) => {
      resolve({ ok: error === null, stdout, stderr })
    })
  })
}

function failure({ stdout, stderr }: GitResult): Failure {
  return { status: 'failed', message: (stdout + stderr).trim() }
}

// A repo owns its subtree, so clones kept inside a project (such as `refs/`) stay out.
// Dot directories and node_modules only hold caches and dependency checkouts.
async function findRepos(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])

  if (entries.some((entry) => entry.name === '.git')) return [dir]

  const nested = await Promise.all(
    entries.flatMap((entry) =>
      entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules'
        ? [findRepos(join(dir, entry.name))]
        : []
    )
  )

  return nested.flat()
}

async function readSync(path: string): Promise<Sync | undefined> {
  const { ok, stdout } = await git(path, [
    'rev-list',
    '--left-right',
    '--count',
    'HEAD...@{upstream}'
  ])

  if (!ok) return undefined

  const [ahead, behind] = stdout.trim().split('\t').map(Number)

  return { ahead, behind }
}

async function readRepo(path: string): Promise<Repo | undefined> {
  const refs = await git(path, [
    'rev-parse',
    '--path-format=absolute',
    '--git-common-dir',
    '--abbrev-ref',
    'HEAD'
  ])

  if (!refs.ok) return undefined

  const [gitDir, branch] = refs.stdout.split('\n')

  // Config names the upstream even while its ref is missing locally, where `@{upstream}` fails; the
  // fetch then restores the ref or reports it gone. A detached HEAD reads as the branch "HEAD".
  const tracking = await git(path, [
    'for-each-ref',
    '--format=%(upstream:short)',
    `refs/heads/${branch}`
  ])

  const upstream = tracking.stdout.trim()

  if (upstream === '') return undefined

  const [remote, sync] = await Promise.all([git(path, ['ls-remote', '--get-url']), readSync(path)])

  return { path, gitDir, branch, upstream, remote: remote.stdout.trim(), sync }
}

async function head(path: string): Promise<string> {
  const { stdout } = await git(path, ['rev-parse', 'HEAD'])

  return stdout.trim()
}

export async function scan(root: string): Promise<Repo[]> {
  const repos = await Promise.all((await findRepos(root)).map(readRepo))

  return repos.filter((repo) => repo !== undefined)
}

export async function fetch(path: string): Promise<Result<FetchOutcome>> {
  const result = await git(path, ['fetch'])
  const sync = await readSync(path)

  if (!result.ok) return { sync, outcome: failure(result) }

  if (sync === undefined) {
    return { sync, outcome: { status: 'failed', message: 'The upstream branch no longer exists.' } }
  }

  return { sync, outcome: { status: 'fetched' } }
}

export async function pull(path: string): Promise<Result<PullOutcome>> {
  const before = await head(path)
  const result = await git(path, ['pull', '--ff-only'])
  const after = await head(path)
  const sync = await readSync(path)

  if (!result.ok) return { sync, outcome: failure(result) }

  if (before === after) return { sync, outcome: { status: 'current' } }

  const log = await git(path, [
    'log',
    '--no-show-signature',
    '--format=%h%x1f%s%x1f%an%x1f%cr',
    `${before}..${after}`
  ])

  const commits = log.stdout
    .trim()
    .split('\n')
    .map((line) => {
      const [hash, subject, author, date] = line.split('\x1f')

      return { hash, subject, author, date }
    })

  return { sync, outcome: { status: 'updated', commits } }
}
