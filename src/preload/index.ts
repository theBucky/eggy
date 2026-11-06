import { contextBridge, ipcRenderer } from 'electron'
import { homedir } from 'node:os'
import type { Api, Events, Ipc } from '../shared/api'

function invoke<Channel extends keyof Ipc>(channel: Channel) {
  return (...args: Parameters<Ipc[Channel]>): Promise<Awaited<ReturnType<Ipc[Channel]>>> =>
    ipcRenderer.invoke(channel, ...args)
}

function on<Channel extends keyof Events>(channel: Channel) {
  return (listener: (...args: Events[Channel]) => void): void => {
    ipcRenderer.on(channel, (_, ...args: Events[Channel]) => listener(...args))
  }
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
  onProgress: on('progress')
}

contextBridge.exposeInMainWorld('api', api)
