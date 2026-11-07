import { run } from './run'

// Like Squirrel, this trusts a replacement only when its code signature meets the installed app's
// designated requirement.
export async function verifySigner(installed: string, replacement: string): Promise<void> {
  const requirement = (await run('codesign', ['-d', '-r-', installed])).replace(
    /^designated => /,
    ''
  )

  // Chrome ships Finder info on its files, which sits outside the signature, so the sideband check
  // stays off.
  try {
    await run('codesign', [
      '--verify',
      '--deep',
      '--strict=symlinks',
      `-R=${requirement}`,
      replacement
    ])
  } catch {
    throw new Error("The update isn't signed by the app's developer.")
  }
}
