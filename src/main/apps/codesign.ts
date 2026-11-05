import { run } from './run'

// Like Squirrel, this trusts a replacement only when its code signature meets the installed app's
// designated requirement.
export async function verifySigner(installed: string, replacement: string): Promise<void> {
  const requirement = (await run('codesign', ['-d', '-r-', installed])).replace(
    /^designated => /,
    ''
  )

  try {
    await run('codesign', ['--verify', '--deep', '--strict', `-R=${requirement}`, replacement])
  } catch {
    throw new Error("The update isn't signed by the app's developer.")
  }
}
