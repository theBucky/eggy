import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  Commit,
  CommitDetail,
  Failure,
  FetchResult,
  History,
  PullCommand,
  PullResult,
  Repo,
  Sync,
  Tracking
} from '../shared/api'

type GitResult = {
  ok: boolean
  stdout: string
  stderr: string
}

// Finder starts the app with launchd's minimal PATH, which hides Homebrew tools that git runs by
// name, such as git-lfs and credential helpers. A login shell reports the PATH the user expects. A
// repo that needs credentials should fail fast instead of waiting on a prompt nobody sees.
const env = new Promise<NodeJS.ProcessEnv>((resolve) => {
  execFile(process.env.SHELL ?? '/bin/zsh', ['-lc', 'printf %s "$PATH"'], (_, loginPath) => {
    resolve({ ...process.env, PATH: loginPath || process.env.PATH, GIT_TERMINAL_PROMPT: '0' })
  })
})

async function git(cwd: string, args: string[]): Promise<GitResult> {
  // A large pull prints a diffstat line per file, and hitting the default 1 MB cap kills git
  // midway through updating the working tree.
  const options = { cwd, env: await env, maxBuffer: Infinity }

  return new Promise((resolve) => {
    execFile('git', args, options, (error, stdout, stderr) => {
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

function parseLog({ ok, stdout }: GitResult, pages?: string): Commit[] {
  if (!ok) return []

  return stdout
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, subject, author, date] = line.split('\x1f')
      const url = pages === undefined ? undefined : `${pages}${hash}`

      return { hash, subject, author, date: Number(date) * 1000, url }
    })
}

function commitPagesOf(remote: string): string | undefined {
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

async function readHistory(path: string, remote: string): Promise<History> {
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

  return {
    unpushed: parseLog(unpushed),
    pushed: parseLog(pushed, commitPagesOf(remote))
  }
}

async function readTracking(path: string): Promise<Tracking> {
  const remote = (await git(path, ['ls-remote', '--get-url'])).stdout.trim()
  const [sync, history] = await Promise.all([readSync(path), readHistory(path, remote)])

  return { remote, sync, history }
}

async function readRepo(path: string): Promise<Repo | undefined> {
  // upstream config survives a missing local ref, where `@{upstream}` fails.
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

  return { path, gitDir, branch, upstream, ...(await readTracking(path)) }
}

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

const CONCURRENCY = 16

export async function scan(root: string): Promise<Repo[]> {
  const queue = (await findRepos(root)).entries()
  const repos: (Repo | undefined)[] = []

  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (const [index, path] of queue) repos[index] = await readRepo(path)
    })
  )

  return repos.filter((repo) => repo !== undefined)
}

export async function fetch(path: string): Promise<FetchResult> {
  const result = await git(path, ['fetch', '--tags', '--force'])
  const tracking = await readTracking(path)

  if (!result.ok) return { ...tracking, outcome: failure(result) }

  if (tracking.sync === undefined) {
    return {
      ...tracking,
      outcome: { status: 'failed', message: 'The upstream branch no longer exists.' }
    }
  }

  return { ...tracking, outcome: { status: 'fetched' } }
}

export async function pull(path: string, command: PullCommand): Promise<PullResult> {
  // Git keeps a paused rebase's state in one of these directories, even after switching branches.
  const { stdout } = await git(path, [
    'rev-parse',
    '--path-format=absolute',
    'HEAD',
    '--git-path',
    'rebase-merge',
    '--git-path',
    'rebase-apply'
  ])

  const [before, ...states] = stdout.trim().split('\n')
  const rebasing = states.some((state) => existsSync(state))

  // Git's conflict hints explain how to continue a rebase that the abort below undoes.
  const result = await git(
    path,
    command === 'rebase'
      ? ['-c', 'advice.mergeConflict=false', 'pull', '--rebase', '--autostash']
      : ['pull', '--ff-only']
  )

  // A rebase stopped on a conflict detaches HEAD, which hides the repo from scans, so the branch
  // and any stashed changes go back to how they were. A rebase already underway, such as one paused
  // in a terminal, isn't this pull's to abort.
  const aborted =
    command === 'rebase' && !rebasing && !result.ok && (await git(path, ['rebase', '--abort'])).ok

  const [tracking, added, unmerged] = await Promise.all([
    readTracking(path),
    git(path, ['rev-list', '--count', `${before}..@{upstream}`]),
    // Git still exits cleanly when the stashed changes conflict on top of the rebased branch.
    git(path, ['diff', '--name-only', '--diff-filter=U'])
  ])

  if (!result.ok || unmerged.stdout !== '') {
    const outcome = failure(result)

    if (aborted) outcome.message += '\n\nRebase aborted, so the branch is unchanged.'

    return { ...tracking, outcome }
  }

  // Counting from the upstream leaves out local commits that a rebase replays under new hashes.
  const count = Number(added.stdout)

  if (count === 0) return { ...tracking, outcome: { status: 'current' } }

  return { ...tracking, outcome: { status: 'updated', count } }
}

export async function show(path: string, hash: string): Promise<CommitDetail> {
  // A merge diffs against its first parent, since combined diffs have no patch form to parse. The
  // prefixes override `diff.noprefix`, whose paths the parser misreads.
  const { stdout } = await git(path, [
    'show',
    '--no-show-signature',
    '--no-color',
    '--no-ext-diff',
    '--src-prefix=a/',
    '--dst-prefix=b/',
    '--diff-merges=first-parent',
    '--ignore-all-space',
    '--ignore-blank-lines',
    '--format=%b%x00',
    hash
  ])

  const split = stdout.indexOf('\0')

  return { body: stdout.slice(0, split).trim(), patch: stdout.slice(split + 1) }
}
