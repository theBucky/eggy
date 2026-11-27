import type { Failure } from './failure'

export type PackageKind = 'formula' | 'cask'

export type Package = {
  kind: PackageKind
  name: string
  fullName: string
  description: string | undefined
  homepage: string | undefined
  tap: string | undefined
  version: string
  latest: string
  requested: boolean
  state: 'pinned' | 'outdated' | 'current'
}

export type PackageList =
  | { status: 'listed'; packages: Package[] }
  | { status: 'missing' }
  | Failure

export type PackageCheck = { status: 'checked'; packages: Package[] } | Failure

export type PackageUpgrade = { status: 'upgraded' } | Failure
