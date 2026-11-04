import { execFile, spawnSync } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Commit, Failure, FetchResult, History, PullResult, Repo, Sync } from '../shared/api'

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

const log = ['log', '--no-show-signature', '--max-count=10', '--format=%h%x1f%s%x1f%an%x1f%ct']

function parseLog({ ok, stdout }: GitResult): Commit[] {
  if (!ok) return []

  return stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, subject, author, date] = line.split('\x1f')

      return { hash, subject, author, date: Number(date) * 1000 }
    })
}

// The list folds unpushed commits away, so pushed ones get their own ten to keep the list full.
async function readHistory(path: string): Promise<History> {
  const [unpushed, bases] = await Promise.all([
    git(path, [...log, '@{upstream}..HEAD']),
    git(path, ['merge-base', '--all', 'HEAD', '@{upstream}'])
  ])

  // Commits reachable from any merge base are exactly those on both sides. Without a local
  // upstream ref both commands fail and every commit reads as pushed.
  const pushed = await git(path, [
    ...log,
    ...(unpushed.ok ? bases.stdout.trim().split('\n') : ['HEAD'])
  ])

  return { unpushed: parseLog(unpushed), pushed: parseLog(pushed) }
}

// Forges serve a repository's pages at its clone URL without `.git`, and SSH remotes, including
// git's `user@host:path` shorthand, map to the same host over HTTPS.
function commitUrlOf(remote: string): string | undefined {
  const scp = /^(?:[^@/]+@)?([^/:]+):(?!\/\/)(.+)$/.exec(remote)
  const url = URL.parse(scp ? `ssh://${scp[1]}/${scp[2]}` : remote)

  if (url === null) return undefined

  const repo = url.pathname.replace(/(\.git)?\/?$/, '')

  const route =
    url.hostname === 'bitbucket.org'
      ? 'commits'
      : url.hostname.endsWith('.googlesource.com')
        ? '+'
        : 'commit'

  if (url.protocol === 'https:' || url.protocol === 'http:') {
    return `${url.origin}${repo}/${route}/`
  }

  if (url.protocol === 'ssh:' || url.protocol === 'git:') {
    return `https://${url.hostname}${repo}/${route}/`
  }

  return undefined
}

async function readRepo(path: string): Promise<Repo | undefined> {
  // Config names the upstream even while its ref is missing locally, where `@{upstream}` fails; the
  // fetch then restores the ref or reports it gone. Listing every branch finds the checked-out one
  // by its star without first asking for its name, and a detached HEAD stars none.
  const [commonDir, heads] = await Promise.all([
    git(path, ['rev-parse', '--path-format=absolute', '--git-common-dir']),
    git(path, [
      'for-each-ref',
      '--format=%(HEAD)%(refname:lstrip=2) %(upstream:short)',
      'refs/heads'
    ])
  ])

  const current = /^\*(\S+) (\S+)$/m.exec(heads.stdout)

  if (current === null) return undefined

  const [, branch, upstream] = current
  const gitDir = commonDir.stdout.trim()

  const [{ stdout }, sync, history] = await Promise.all([
    git(path, ['ls-remote', '--get-url']),
    readSync(path),
    readHistory(path)
  ])

  const remote = stdout.trim()

  return { path, gitDir, branch, upstream, remote, commitUrl: commitUrlOf(remote), sync, history }
}

// A repo owns its subtree, so clones kept inside a project (such as `refs/`) stay out.
export async function scan(dir: string): Promise<Repo[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])

  if (entries.some((entry) => entry.name === '.git')) {
    const repo = await readRepo(dir)

    return repo === undefined ? [] : [repo]
  }

  const nested = await Promise.all(
    entries.flatMap((entry) =>
      entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules'
        ? [scan(join(dir, entry.name))]
        : []
    )
  )

  return nested.flat()
}

export async function fetch(path: string): Promise<FetchResult> {
  const result = await git(path, ['fetch', '--tags', '--force'])
  const sync = await readSync(path)

  if (!result.ok) return { sync, outcome: failure(result) }

  if (sync === undefined) {
    return { sync, outcome: { status: 'failed', message: 'The upstream branch no longer exists.' } }
  }

  return { sync, outcome: { status: 'fetched' } }
}

export async function pull(path: string): Promise<PullResult> {
  const before = (await git(path, ['rev-parse', 'HEAD'])).stdout.trim()
  const result = await git(path, ['pull', '--ff-only'])

  const [sync, history, added] = await Promise.all([
    readSync(path),
    readHistory(path),
    git(path, ['rev-list', '--count', `${before}..HEAD`])
  ])

  if (!result.ok) return { sync, history, outcome: failure(result) }

  // A fast-forward only adds commits, so none added means HEAD never moved.
  const count = Number(added.stdout)

  if (count === 0) return { sync, history, outcome: { status: 'current' } }

  return { sync, history, outcome: { status: 'updated', count } }
}
