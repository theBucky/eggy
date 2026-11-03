import { contextBridge, ipcRenderer } from 'electron'
import { homedir } from 'node:os'
import { electronAPI } from '@electron-toolkit/preload'
import type { Api } from '../shared/api'

const api: Api = {
  home: homedir(),
  chooseRoot: (current) => ipcRenderer.invoke('choose-root', current),
  scan: (root) => ipcRenderer.invoke('scan', root),
  fetch: (path) => ipcRenderer.invoke('fetch', path),
  pull: (path) => ipcRenderer.invoke('pull', path)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
