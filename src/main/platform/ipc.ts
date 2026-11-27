import type { IpcMainInvokeEvent } from 'electron'

export type Handlers<Requests> = {
  [Channel in keyof Requests]: Requests[Channel] extends (...args: infer Args) => infer Reply
    ? (event: IpcMainInvokeEvent, ...args: Args) => Reply | Promise<Reply>
    : never
}

export type Send<Events extends Record<keyof Events, unknown[]>> = <Channel extends keyof Events>(
  channel: Channel,
  ...args: Events[Channel]
) => void
