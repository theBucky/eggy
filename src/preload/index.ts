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
  pull: invoke('pull'),
  show: invoke('show'),
  expandWindow: invoke('expandWindow'),
  collapseWindow: invoke('collapseWindow'),
  moveWindow: invoke('moveWindow'),
  listApps: invoke('listApps'),
  check: invoke('check'),
  update: invoke('update'),
  forceUpdate: invoke('forceUpdate'),
  discardUpdate: invoke('discardUpdate'),
  onProgress: (listener) => {
    ipcRenderer.on('progress', (_, path, progress) => listener(path, progress))
  }
}

contextBridge.exposeInMainWorld('api', api)
