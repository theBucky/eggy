import { contextBridge, ipcRenderer } from 'electron'
import { homedir } from 'node:os'
import type { Api, Ipc } from '../shared/api'

function invoke<Channel extends keyof Ipc>(channel: Channel) {
  return (...args: Parameters<Ipc[Channel]>): Promise<Awaited<ReturnType<Ipc[Channel]>>> =>
    ipcRenderer.invoke(channel, ...args)
}

const api: Api = {
  home: homedir(),
  chooseRoot: invoke('chooseRoot'),
  scan: invoke('scan'),
  fetch: invoke('fetch'),
  pull: invoke('pull')
}

contextBridge.exposeInMainWorld('api', api)
