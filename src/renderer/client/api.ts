import type { Api } from '$shared/ipc'

// Preload exposes this global through `contextBridge` before the renderer's first module runs.
declare const api: Api

export const { home, theme, invoke, on } = api
