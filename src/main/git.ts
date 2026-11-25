import { existsSync } from 'node:fs'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  Commit,
  CommitDetail,
  FetchResult,
  History,
  PullCommand,
  PullResult,
  Repo,
  Sync,
  Tracking
} from '$shared/repos'
import { exec } from './exec'
import { loginEnv } from './login-env'

type Output = { ok: boolean; stdout: string; stderr: string }

const env = loginEnv.then((env) => ({ ...env, GIT_TERMINAL_PROMPT: '0' }))

async function git(cwd: string, args: string[]): Promise<Output> {
  const { exit, stdout, stderr } = await exec('git', args, { cwd, env: await env })

  return { ok: exit === 0, stdout, stderr: exit instanceof Error ? exit.message : stderr }
}

function messageOf({ stdout, stderr }: Output): string {
  return (stdout + stderr).trim()
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

function parseLog(stdout: string, pages?: string): Commit[] {
  return stdout.split('\n').flatMap((line) => {
    if (line === '') return []

    const [hash, subject, author, date] = line.split('\x1f')
    const url = pages === undefined ? undefined : `${pages}${hash}`

    return [{ hash, subject, author, date: Number(date) * 1000, url }]
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

  const pushed = await git(path, [
    ...log,
    ...(unpushed.ok ? bases.stdout.trim().split('\n') : ['HEAD'])
  ])

  return {
    unpushed: parseLog(unpushed.stdout),
    pushed: parseLog(pushed.stdout, commitPagesOf(remote))
  }
}

async function readTracking(path: string): Promise<Tracking> {
  const remote = (await git(path, ['ls-remote', '--get-url'])).stdout.trim()
  const [sync, history] = await Promise.all([readSync(path), readHistory(path, remote)])

  return { remote, sync, history }
}

async function readRepo(path: string): Promise<Repo | undefined> {
  // Upstream config survives a missing local ref, where `@{upstream}` fails.
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

  return {
    path,
    commonDir: commonDir.stdout.trim(),
    branch,
    upstream,
    ...(await readTracking(path))
  }
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

export async function scan(root: string): Promise<Repo[]> {
  const queue = (await findRepos(root)).entries()
  const repos: (Repo | undefined)[] = []

  await Promise.all(
    Array.from({ length: 16 }, async () => {
      for (const [index, path] of queue) repos[index] = await readRepo(path)
    })
  )

  return repos.filter((repo) => repo !== undefined)
}

export async function fetch(path: string): Promise<FetchResult> {
  const fetched = await git(path, ['fetch', '--tags', '--force'])
  const tracking = await readTracking(path)

  if (!fetched.ok) return { tracking, outcome: { status: 'failed', message: messageOf(fetched) } }

  if (tracking.sync === undefined) {
    return {
      tracking,
      outcome: { status: 'failed', message: 'The upstream branch no longer exists.' }
    }
  }

  return { tracking, outcome: { status: 'fetched' } }
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

  const pulled = await git(
    path,
    command === 'rebase'
      ? ['-c', 'advice.mergeConflict=false', 'pull', '--rebase', '--autostash']
      : ['pull', '--ff-only']
  )

  // A conflicted rebase detaches HEAD, hiding the repository from branch scans.
  const aborted =
    command === 'rebase' && !rebasing && !pulled.ok && (await git(path, ['rebase', '--abort'])).ok

  const [tracking, added, unmerged] = await Promise.all([
    readTracking(path),
    git(path, ['rev-list', '--count', `${before}..@{upstream}`]),
    // Git still exits cleanly when the stashed changes conflict on top of the rebased branch.
    git(path, ['diff', '--name-only', '--diff-filter=U'])
  ])

  if (!pulled.ok || unmerged.stdout !== '') {
    const message = messageOf(pulled)

    return {
      tracking,
      outcome: {
        status: 'failed',
        message: aborted ? `${message}\n\nRebase aborted, so the branch is unchanged.` : message
      }
    }
  }

  const count = Number(added.stdout)

  return { tracking, outcome: count === 0 ? { status: 'current' } : { status: 'updated', count } }
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
