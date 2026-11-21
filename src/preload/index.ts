import { contextBridge, ipcRenderer } from 'electron'
import type { Api, Events, Launch, Requests } from '$shared/ipc'

function invoke<Channel extends keyof Requests>(
  channel: Channel,
  ...args: Parameters<Requests[Channel]>
): Promise<ReturnType<Requests[Channel]>> {
  // SAFETY: main answers each channel through the handler that its `Requests` signature types.
  return ipcRenderer.invoke(channel, ...args) as Promise<ReturnType<Requests[Channel]>>
}

function on<Channel extends keyof Events>(
  channel: Channel,
  listener: (...args: Events[Channel]) => void
): void {
  // SAFETY: main sends each event through `send`, which types its arguments by `Events`.
  ipcRenderer.on(channel, (_, ...args) => listener(...(args as Events[Channel])))
}

const api: Api = {
  // SAFETY: main answers this channel with a value that satisfies `Launch`.
  ...(ipcRenderer.sendSync('launch') as Launch),
  invoke,
  on
}

contextBridge.exposeInMainWorld('api', api)
