import { execFile } from 'node:child_process'

// Finder starts the app with launchd's minimal PATH, which hides Homebrew and the tools that git runs
// by name, such as git-lfs and credential helpers. A login shell reports the PATH the user expects.
export const loginEnv = new Promise<NodeJS.ProcessEnv>((resolve) => {
  execFile(process.env.SHELL ?? '/bin/zsh', ['-lc', 'printf %s "$PATH"'], (_, loginPath) => {
    resolve({ ...process.env, PATH: loginPath || process.env.PATH })
  })
})
