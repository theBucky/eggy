const { home } = window.api

export function tilde(path: string): string {
  return path === home || path.startsWith(`${home}/`) ? `~${path.slice(home.length)}` : path
}

export function nameOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

export function dirOf(path: string): string {
  return path.slice(0, path.lastIndexOf('/'))
}
