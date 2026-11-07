import { app, nativeTheme } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as z from 'zod'
import { THEMES, type Theme } from '../shared/api'

const SavedTheme = z.enum(THEMES)

const path = join(app.getPath('userData'), 'theme')

// Electron forgets the theme between launches, so the saved one applies before the window opens.
export function restoreTheme(): void {
  try {
    nativeTheme.themeSource = SavedTheme.parse(readFileSync(path, 'utf8'))
  } catch {
    // Without a saved theme, the app follows the system.
  }
}

export function setTheme(theme: Theme): void {
  nativeTheme.themeSource = theme
  writeFileSync(path, theme)
}

// Matches `--sidebar` in main.css, so a resize never flashes another color past the page.
export function sidebarColor(): string {
  return nativeTheme.shouldUseDarkColors ? '#141414' : '#f5f5f5'
}
