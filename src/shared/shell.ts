export const THEMES = ['system', 'light', 'dark'] as const

export type Theme = (typeof THEMES)[number]

export type MenuCommand = 'settings' | 'refresh'

export type Launch = {
  home: string
  theme: Theme
}

export type Requests = {
  setTheme: (theme: Theme) => void
  planWindowExpansion: (width: number) => number
  planWindowCollapse: () => number
  moveWindow: () => void
}

export type Events = {
  menuCommand: [command: MenuCommand]
}
