import { contextBridge, ipcRenderer } from 'electron'
import { homedir } from 'node:os'
import type { Api, Events, Ipc } from '../shared/api'

function invoke<Channel extends keyof Ipc>(channel: Channel) {
  return (...args: Parameters<Ipc[Channel]>) =>
    // SAFETY: main answers each channel through the handler that its `Ipc` signature types.
    ipcRenderer.invoke(channel, ...args) as ReturnType<Ipc[Channel]>
}

function on<Channel extends keyof Events>(channel: Channel) {
  return (listener: (...args: Events[Channel]) => void): void => {
    // SAFETY: main sends each event through `send`, which types its arguments by `Events`.
    ipcRenderer.on(channel, (_, ...args) => listener(...(args as Events[Channel])))
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
  upgrade: invoke('upgrade'),
  forceUpgrade: invoke('forceUpgrade'),
  discardUpgrade: invoke('discardUpgrade'),
  listPackages: invoke('listPackages'),
  checkPackages: invoke('checkPackages'),
  upgradePackage: invoke('upgradePackage'),
  onProgress: on('progress'),
  onOutput: on('output')
}

contextBridge.exposeInMainWorld('api', api)
