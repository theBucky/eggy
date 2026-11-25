import { app, nativeTheme } from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as z from 'zod'
import { THEMES, type Theme } from '$shared/theme'

const SavedTheme = z.enum(THEMES)

const path = join(app.getPath('userData'), 'theme')

function savedTheme(): Theme | undefined {
  try {
    return SavedTheme.parse(readFileSync(path, 'utf8'))
  } catch {
    return undefined
  }
}

export function restoreTheme(): void {
  nativeTheme.themeSource = savedTheme() ?? 'system'
}

export function setTheme(theme: Theme): void {
  nativeTheme.themeSource = theme
  writeFileSync(path, theme)
}
