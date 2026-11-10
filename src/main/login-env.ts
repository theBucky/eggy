import { exec } from './exec'

// Finder starts the app with launchd's minimal PATH, which hides Homebrew and the tools that git runs
// by name, such as git-lfs and credential helpers. A login shell reports the PATH the user expects.
export const loginEnv = exec(process.env.SHELL ?? '/bin/zsh', ['-lc', 'printf %s "$PATH"']).then(
  ({ stdout }): NodeJS.ProcessEnv => ({ ...process.env, PATH: stdout || process.env.PATH })
)
