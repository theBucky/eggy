import type * as apps from './apps'
import type * as optimize from './optimize'
import type * as packages from './packages'
import type * as repos from './repos'
import type * as shell from './shell'

type Join<Left, Right extends Record<keyof Left & keyof Right, never>> = Left & Right

export type Requests = Join<
  Join<Join<Join<apps.Requests, optimize.Requests>, packages.Requests>, repos.Requests>,
  shell.Requests
>

export type Events = Join<Join<Join<apps.Events, optimize.Events>, packages.Events>, shell.Events>

export type Api = shell.Launch & {
  invoke: <Channel extends keyof Requests>(
    channel: Channel,
    ...args: Parameters<Requests[Channel]>
  ) => Promise<ReturnType<Requests[Channel]>>
  on: <Channel extends keyof Events>(
    channel: Channel,
    listener: (...args: Events[Channel]) => void
  ) => void
}
