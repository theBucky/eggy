import { contextBridge, ipcRenderer } from 'electron'
import { homedir } from 'node:os'
import type { Api, Events, Ipc, Theme } from '$shared/api'

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
  // SAFETY: main answers with `nativeTheme.themeSource`, whose values `Theme` lists.
  theme: ipcRenderer.sendSync('theme') as Theme,
  chooseRoot: invoke('chooseRoot'),
  scanRepos: invoke('scanRepos'),
  fetchRepo: invoke('fetchRepo'),
  pullRepo: invoke('pullRepo'),
  showCommit: invoke('showCommit'),
  planWindowExpansion: invoke('planWindowExpansion'),
  planWindowCollapse: invoke('planWindowCollapse'),
  moveWindow: invoke('moveWindow'),
  listApps: invoke('listApps'),
  checkApp: invoke('checkApp'),
  upgradeApp: invoke('upgradeApp'),
  forceAppUpgrade: invoke('forceAppUpgrade'),
  discardAppUpgrade: invoke('discardAppUpgrade'),
  listPackages: invoke('listPackages'),
  checkPackages: invoke('checkPackages'),
  upgradePackage: invoke('upgradePackage'),
  setTheme: invoke('setTheme'),
  inspectMachine: invoke('inspectMachine'),
  optimize: invoke('optimize'),
  review: invoke('review'),
  onAppProgress: on('appProgress'),
  onPackageOutput: on('packageOutput'),
  onOptimization: on('optimization'),
  onMenuCommand: on('menuCommand')
}

contextBridge.exposeInMainWorld('api', api)
